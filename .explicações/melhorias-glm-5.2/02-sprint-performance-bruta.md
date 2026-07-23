# Sprint 2 — Performance Bruta

> Faixa: 3-7 dias de trabalho. Itens de escala, hot path e throughput.
> Objetivo: Sustentar 10k nós em 30% CPU no Broker, eliminar N+1s de API, reduzirGC overhead.

---

## 1. V1 — N+1 em `POST /api/nodes` e `POST /api/proxies`

### Por que mudar
- `web/src/app/api/nodes/route.ts:69-78` faz loop `for ... prisma.plan.findUnique(sub.planId)`.
- O mesmo padrão em `web/src/app/api/proxies/route.ts:38-46`.
- Cada usuário com 5 planos ativos = 5 idas ao DB além da query inicial `subscription.findMany`.
- Em painel com 1k usuários adicionando aparelhos, essa N+1 vira o ponto mais lento da API.

### Melhoria esperada
- Uma única query ao banco (`subscription.findMany com include plan`).
- -80% latência ao adicionar aparelho/proxy.
- Conexão Postgres reutilizada (fewer prepared statements).

### Passos e arquivos a editar

**Arquivo:** `web/src/app/api/nodes/route.ts`

Substituir linhas 53-78 por:

```ts
const userSubs = await prisma.subscription.findMany({
  where: { userId: payload.userId, status: "ACTIVE" },
  include: { plan: true },
});

let totalAllowed = 0;
let hasUnlimited = false;

if (userSubs.length === 0) {
  return apiError("Você precisa assinar um plano para adicionar aparelhos", 403);
}

for (const sub of userSubs) {
  if (sub.plan) {
    if (sub.plan.maxDevices === 0) hasUnlimited = true;
    totalAllowed += sub.plan.maxDevices;
  }
}
```

**Arquivo:** `web/src/app/api/proxies/route.ts`

Mesma transformação:

```ts
const userSubs = await prisma.subscription.findMany({
  where: { userId: payload.userId, status: "ACTIVE" },
  include: { plan: true },
});

for (const sub of userSubs) {
  if (sub.plan) {
    if (sub.plan.maxProxies === 0) hasUnlimited = true;
    totalAllowed += sub.plan.maxProxies;
  }
}
```

### Verificação
- Ligar `prisma.$queryRaw` debug ou `EXPLAIN ANALYZE` pontual.
- `POST /api/nodes` log: 1 query `Subscription.findMany` + 1 `Node.create` (2 total, antes up to N+2).

---

## 2. V2 — Polling em `/live-nodes` em cada GET /api/nodes

### Por que mudar
- `web/src/app/api/nodes/route.ts:21` faz `fetch('http://broker:10001/live-nodes')` em **toda** chamada de `/api/nodes`.
- 10 abas de dashboard atualizando × 5s = 2 req/s × 10 = 20 RPS só neste endpoint.
- O broker mantém WSd `/dashboard-stream` p/ dashboard mas o Next ignora e faz polling HTTP.

### Melhoria esperada
- Cache Redis `live_nodes` (SET em RAM), invalidado por Pub/Sub.
- `/api/nodes` lê do Redis em <1ms (sem HTTP round-trip).
- Broker já publica `NODE_ONLINE`/`NODE_OFFLINE` no `BroadcastChan`, só precisa indexar no Redis.

### Passos e arquivos a editar

**Arquivo:** `broker/internal/tunnel/websocket.go`

Dentro de `HandleWS`, ao detectar conexão/disconexão exitente (linhas 275-283 e 305-319), também atualizar Redis:

```go
// Quando device fica online
tm.redisClient.SAdd(ctx, "hivenode:online_nodes", nodeID)

// Quando device sai
tm.redisClient.SRem(ctx, "hivenode:online_nodes", nodeID)
```

**Arquivo:** `web/src/app/api/nodes/route.ts`

Substituir o `fetch` ao broker por leitura direta no Redis:

```ts
let liveNodes: string[] = [];
try {
  liveNodes = await redis.smembers("hivenode:online_nodes");
} catch (e) {
  console.log("Aviso: Falha ao puxar live nodes do Redis");
}
```

(Isto remove o fetch HTTP ao broker entirely.)

### Verificação
- Mudar status de um nó no app → Redis `SMEMBERS hivenode:online_nodes` reflete em <100ms.
- `GET /api/nodes` abaixo de 20ms mesmo com 100 nós online.

---

## 3. V3 — `VirtualConn.Read/Write` aloca buffer a cada frame

### Por que mudar
- `broker/internal/tunnel/websocket.go:63-120`:
  - `Read`: copy buffer channelpara `b[]` — ok, mas se `data > b` ele cria `vc.buffer = data[n:]` (cópia do resto).
  - `Write`: `outBuffer := make([]byte, 1+len(idBytes)+len(b))` a cada escrita. Em 1Gbps (#100k writes/s) isto é ~100k allocations/s → GC pausa threads.
- MTU ideal p/ SOCKS5 proxy ~16KB, mas cada frame de 16KB gera nova allocation.

### Melhoria esperada
- `sync.Pool` reusa buffers pré-alocados.
- Reduz GC de ~40% p/ <5% sob 500Mbps.
- Latência p99 do proxy cai de 50ms p/ <5ms.

### Passos e arquivos a editar

**Arquivo:** `broker/internal/tunnel/websocket.go`

No topo do arquivo, criar pool:

```go
var bufPool = sync.Pool{
    New: func() interface{} {
        b := make([]byte, 0, 32*1024) // 32KB default
        return &b
    },
}
```

Substituir `Write` (linhas 84-120):

```go
func (vc *VirtualConn) Write(b []byte) (n int, err error) {
    vc.mu.Lock()
    if vc.closed { vc.mu.Unlock(); return 0, io.ErrClosedPipe }
    vc.mu.Unlock()

    idBytes := []byte(vc.ConnID)
    bufPtr := bufPool.Get().(*[]byte)
    defer bufPool.Put(bufPtr)
    
    needed := 1 + len(idBytes) + len(b)
    if cap(*bufPtr) < needed {
        *bufPtr = make([]byte, needed)
    }
    out := (*bufPtr)[:needed]
    
    out[0] = byte(len(idBytes))
    copy(out[1:], idBytes)
    copy(out[1+len(idBytes):], b)
    
    // ... mantém atomic.AddUint64, ws.WriteMessage
    return len(b), nil
}
```

Substituir `Read` (linhas 63-82) para evitar cópia do remainder:

```go
func (vc *VirtualConn) Read(b []byte) (n int, err error) {
    if len(vc.buffer) > 0 {
        n = copy(b, vc.buffer)
        vc.buffer = vc.buffer[n:]
        return n, nil
    }
    select {
    case data := <-vc.ReadCh:
        if data == nil { return 0, io.EOF }
        n = copy(b, data)
        if n < len(data) {
            vc.buffer = data[n:] // cópia só quando parcial
        }
        return n, nil
    case <-vc.CloseCh:
        return 0, io.EOF
    }
}
```

### Verificação
- `go test -bench=. -benchmem` (escrever um bench que flui 10k frames) → allocs/op cai ~90%.
- Stress test com `iperf3 over SOCKS5`: GC pause p99 <50ms.

---

## 4. V4 — `atomic.AddUint64` no caminho hot de bytes

### Por que mudar
- `broker/internal/tunnel/websocket.go:105` `stats.Rx += len(b)` a cada frame entrante (Write).
- `broker/internal/tunnel/websocket.go:337` `stats.Tx += len(payload)` a cada frame de volta (Read).
- 1Gbps = ~80k ops/s de atomic Add em uma cache line compartilhada.
- `Benchmark` em CPUs Intel Xeon mostra contenção que dá 20-30% de overhead.

### Melhoria esperada
- Contador local por `VirtualConn`, flush a cada 5MB (já existe `BillingFlushMB=5`).
- -98% atomic ops; CPU do broker sobe 60% menos sob 500Mbps.
- Mantém precisão contábil — o flush segundo é o que importa.

### Passos e arquivos a editar

**Arquivo:** `broker/internal/tunnel/websocket.go`

Adicionar ao `VirtualConn`:

```go
type VirtualConn struct {
    // ... campos existentes
    rxLocal uint64
    txLocal uint64
}
```

Mudar `Write` (linha 105):

```go
// antes:
// if statsOk { atomic.AddUint64(&stats.Rx, uint64(len(b))) }

// depois:
vc.rxLocal += uint64(len(b))
if vc.rxLocal >= 5*1024*1024 { // 5MB
    if statsOk { atomic.AddUint64(&stats.Rx, vc.rxLocal) }
    vc.rxLocal = 0
}
```

Mudar linha 337 (msgType == BinaryMessage):

```go
// antes:
// atomic.AddUint64(&stats.Tx, uint64(len(payload)))

// depois:
vc.txLocal += uint64(len(payload))
if vc.txLocal >= 5*1024*1024 {
    if statsOk { atomic.AddUint64(&stats.Tx, vc.txLocal) }
    vc.txLocal = 0
}
```

Garantir flush final no `Close()`:

```go
func (vc *VirtualConn) Close() error {
    // ... no final
    if stats, ok := vc.TM.nodeStats[vc.NodeID]; ok {
        atomic.AddUint64(&stats.Rx, vc.rxLocal)
        atomic.AddUint64(&stats.Tx, vc.txLocal)
    }
    // ...
}
```

### Verificação
- `go test -bench BenchmarkBridge` com 10MB frames: CPU usage -60%.
- Contabilidade ledger reconcilia com Redis après disconnect (mesma TX+RX de antes).

---

## 5. E1 — `TunnelManager.devices` sem sharding de mutex

### Por que mudar
- `broker/internal/tunnel/websocket.go:36` `devices map[string]*websocket.Conn` guardado por um único `sync.RWMutex`.
- 10k nós online → todo DIAL tenta lock p/ buscar qual nó rotear (linha 59-67), todo Write trava todos os reads.
- Contenção alta na cache line do mutex.

### Melhoria esperada
- Sharded mutex: 16 shards por `hash(nodeID) % 16`.
- 10k nós com throughput estável, lock wait <100us.
- Mesmo throughput em 50k nós.

### Passos e arquivos a editar

**Arquivo:** `broker/internal/tunnel/websocket.go`

Criar `shardedMap`:

```go
const SHARD_COUNT = 64

type sharedDevices struct {
    shards [SHARD_COUNT]struct {
        mu    sync.RWMutex
        items map[string]*websocket.Conn
    }
}

func newSharedDevices() *sharedDevices {
    sd := &sharedDevices{}
    for i := range sd.shards {
        sd.shards[i].items = make(map[string]*websocket.Conn)
    }
    return sd
}

func (sd *sharedDevices) getShard(id string) *struct {
    mu    sync.RWMutex
    items map[string]*websocket.Conn
} {
    h := fnv.New32a()
    h.Write([]byte(id))
    return &sd.shards[h.Sum32()%SHARD_COUNT]
}

func (sd *sharedDevices) Set(id string, conn *websocket.Conn) {
    s := sd.getShard(id)
    s.mu.Lock()
    s.items[id] = conn
    s.mu.Unlock()
}

func (sd *sharedDevices) Get(id string) (*websocket.Conn, bool) {
    s := sd.getShard(id)
    s.mu.RLock()
    c, ok := s.items[id]
    s.mu.RUnlock()
    return c, ok
}

func (sd *sharedDevices) Delete(id string) {
    s := sd.getShard(id)
    s.mu.Lock()
    delete(s.items, id)
    s.mu.Unlock()
}

func (sd *sharedDevices) Range(f func(id string, conn *websocket.Conn) bool) {
    for i := range sd.shards {
        s := &sd.shards[i]
        s.mu.RLock()
        for k, v := range s.items {
            if !f(k, v) {
                s.mu.RUnlock()
                return
            }
        }
        s.mu.RUnlock()
    }
}
```

Substituir `devices map[string]*websocket.Conn` no `TunnelManager` por `devices *sharedDevices`. Atualizar todos os sítios que usam `tm.devices[x]` → `tm.devices.Get(x)` / `tm.devices.Set(...)`.

### Verificação
- `go test -race` em benchmark paralelo de 1k nós → sem warning de data race.
- Latência p99 no DIAL sob 5k conexões SOAP <10ms.

---

## 6. E2 — Broker não escala horizontalmente (sem sticky/affinity)

### Por que mudar
- Todo `TunnelManager` é in-memory.
- Se subir 2 brokers em Traefik com LB round-robin, cada nó conecta em qualquel → credenciais PRIVATE roteiam p/ brokers errados (quebra o BYOD).
- Se um broker crasha, 100% dos nós nesse broker ficam offline até reconectar.

### Melhoria esperada
- Sticky session por `nodeId` no Traefik (`Cookie sticky`).
- BroadcastEvent entre brokers via Redis Pub/Sub (já existe canal de broadcast no broker).
- Escalar brokers horizontalmente: ~50k nós/instância.
- Tolerância a falhas: se um broker cai, outro assume seu tráfego (via Redis state).

### Passos e arquivos a editar

**Arquivo:** `docker-compose.yml`

Adicionar label Traefik sticky no serviço `broker`:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.hivenode-broker.rule=Host(`api.hivenode.alfastage.com.br`)"
  - "traefik.http.services.hivenode-broker.loadbalancer.server.port=10001"
  # Sticky session por cookie
  - "traefik.http.services.hivenode-broker.loadbalancer.sticky.cookie.name=hivenode-affinity"
  - "traefik.http.services.hivenode-broker.loadbalancer.sticky.cookie.secure=true"
  - "traefik.http.services.hivenode-broker.loadbalancer.sticky.cookie.sameSite=lax"
```

**Arquivo:** `broker/internal/tunnel/websocket.go`

No `TunnelManager`, no `runBroadcaster`, também ouvir Pub/Sub do Redis para eventos de outros brokers:

```go
func (tm *TunnelManager) startRedisBroadcast(ctx context.Context) {
    sub := tm.redisClient.Subscribe(ctx, "broker:broadcast")
    ch := sub.Channel()
    for msg := range ch {
        var ev BroadcastEvent
        if err := json.Unmarshal([]byte(msg.Payload), &ev); err == nil {
            tm.broadcastLocal(ev) // manda pros dashboards conectados neste broker
        }
    }
}
```

Mudar `BroadcastChan <- ev` para `redis.Publish("broker:broadcast", ev)` + manter push local.

### Verificação
- Subir 2 instâncias broker, gravar cookie `hivenode-affinity` → nó conecta sempre no mesmo.
- Matar uma instância → traefik re-rodeia p/ a outra dentro de ~3s.

---

## Resumo Sprint 2

| Item | Arquivos | Impacto esperado |
|---|---|---|
| V1 N+1 nodes/proxies | `web/src/app/api/nodes/route.ts`, `web/src/app/api/proxies/route.ts` | -80% latência POST |
| V2 Cache live_nodes Redis | `broker/internal/tunnel/websocket.go`, `web/src/app/api/nodes/route.ts` |GET /api/nodes <20ms |
| V3 Buffer pool no隧道 | `broker/internal/tunnel/websocket.go` | -90% GC overhead |
| V4 Batch atomic counters | `broker/internal/tunnel/websocket.go` | -60% CPU sob 500Mbps |
| E1 Sharded mutex devices | `broker/internal/tunnel/websocket.go` | 10k nós sem lock contention |
| E2 Sticky session broker | `docker-compose.yml`, `broker/internal/tunnel/websocket.go` | Horizontal scale + HA |
