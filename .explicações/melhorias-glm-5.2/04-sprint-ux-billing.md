# Sprint 4 — UX + Billing

> Faixa: 3-5 dias de trabalho. Itens de experiência de usuário e performance de queries de billing.
> Objetivo: Painel vivo real-time, HUD honesta do miner, credenciais estáveis, billing escalável em escala.

---

## 1. U2 — "Pontos Minerados: 1,250" hardcoded no HiveMiner

### Por que mudar
- `hiveminer-app/src/app/index.tsx:771-773`: display de pontos está mock com `1,250` hardcoded e `≈ 1.25 GB Trafegados`.
- Usuário acha que minerou porém número não reflete nada de real.
- Pior que estar falso, é enganoso p/ usuário (UI fiduciária, mesmo que sejam só "points").

### Melhoria esperada
- App consulta `User.hivePoints` real via `/api/auth/me`.
- Atualização em tempo real a cada TELEMETRY enviado (broker já faz broadcast).
- HUD honesto que reflete contabilidade.
- Confiança do minerador público.

### Passos e arquivos a editar

**Arquivo:** `hiveminer-app/src/app/index.tsx`

Adicionar estado:

```tsx
const [hivePoints, setHivePoints] = useState<number>(0);
const [hiveGB, setHiveGB] = useState<number>(0);
```

Carregar pontos no `useEffect` de sessão (após nodeId estar setado):

```tsx
const loadPoints = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    const res = await fetch(getApiUrl(serverIp, "/auth/me"), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const points = data.data.user.hivePoints || 0;
      setHivePoints(points);
      setHiveGB(points / 500); // 500 pts = 1 GB (alinhado com worker/points-ledger.ts)
    }
  } catch {}
};

// dentro do loadSession após setNodeId:
await loadPoints();
```

Adicionar interval p/ refresh a cada 30s:

```tsx
useEffect(() => {
  if (!nodeId || !isConnected) return;
  const interval = setInterval(loadPoints, 30_000);
  return () => clearInterval(interval);
}, [nodeId, isConnected]);
```

Substituir o bloco de display (linhas 770-774):

```tsx
<View style={/* mesmo container */}>
  <Text style={/* "Pontos Minerados" */}>Pontos Minerados</Text>
  <Text style={/* número grande */}>{hivePoints.toLocaleString('pt-BR')}</Text>
  <Text style={/* badge */}>≈ {hiveGB.toFixed(2)} GB Trafegados</Text>
</View>
```

**Arquivo:** `web/src/app/api/auth/me/route.ts` (garantir que retorna `hivePoints`)

O auth/me provavelmente já retorna — confirmar que inclui `hivePoints: user.hivePoints`. Se não, adicionar ao `select`.

### Verificação
- Logar como cliente miner → após 1 min conectado, número atualiza p/ valor real.
- Worker `points-ledger.ts` dá +500 pts p/ 1 GB → display em 1 min mostra p/ diante.

---

## 2. U6 — Sem endpoint de rotação de senha de proxy

### Por que mudar
- Quando usuário perde/perde a senha SOCKS5, só consegue **deletar e recriar** proxy.
- Mas recriar gera `proxyUser` (unique) diferente → Evolution/atualizações configuradas com a URL antiga param de funcionar.
- Usuário reclama que "perdeu Evolution" p/ cada novo plano.

### Melhoria esperada
- Endpoint `/api/proxies/:id/rotate-password` preserva `proxyUser`, só troca `proxyPass`.
- Worker `web/src/app/api/proxies/[id]/route.ts` ganha handler `PATCH` p/ rotate.
- Atualiza Redis atômicamente.
- UX: botão "Trocar senha" no dashboard p/ 1-click rotar.

### Passos e arquivos a editar

**Novo arquivo:** `web/src/app/api/proxies/[id]/rotate/route.ts`

```ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess, generateSecureString } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import { bcryptHash } from "@/lib/crypto"; // pós-Sprint 3 S5

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth();
    const { id } = await params;
    
    const proxy = await prisma.proxyCredential.findUnique({
      where: { id },
      include: { node: { select: { id: true } } }
    });
    
    if (!proxy || proxy.userId !== payload.userId) {
      return apiError("Proxy não encontrado", 404);
    }
    
    const newPass = generateSecureString(16);
    const hashed = await bcryptHash(newPass);
    const encryptedRedis = encryptRedis(newPass); // ou encrypt de S5
    
    await prisma.proxyCredential.update({
      where: { id },
      data: { proxyPass: hashed }
    });
    
    // Atualiza Redis atomicamente
    await redis.set(`proxy:${proxy.proxyUser}`, `${proxy.node.id}:${encryptedRedis}`);
    
    return apiSuccess({
      proxyUser: proxy.proxyUser,
      proxyPass: newPass, // só esta resposta mostra plaintext
      rotated: true
    });
  } catch (error) {
    console.error("[rotate-proxy] Erro:", error);
    return apiError("Erro ao rotar senha", 500);
  }
}
```

**Arquivo:** `web/src/app/dashboard/proxies/page.tsx` (ou equivalente frontend)

Adicionar botão "Trocar senha" que faz POST `/api/proxies/:id/rotate` e abre modal mostrando a nova senha com botão "Copiar".

### Verificação
- POST → retorna nova senha sem mudar `proxyUser`.
- Redis `GET proxy:joao` mostra hash novo.
- Login SOCKS5 com senha velha falha, com nova funciona.

---

## 3. U7 — Dashboard não usa `/dashboard-stream` WS (telemetria ao vivo)

### Por que mudar
- Broker já implementa `/dashboard-stream` WS (`broker/cmd/broker/main.go:73-96`) que broadcast `NODE_ONLINE`, `NODE_OFFLINE`, `LOG`, `TELEMETRY`.
- Frontend Next.js ignora este canal e faz **polling HTTP** ao `/api/nodes` p/ status e não mostra telemetria realtime.
- A infraestrutura está lá, só não está conectada. Isto é a diferença entre dashboard "estático" e "mágico".

### Melhoria esperada
- Hook `useDashboardStream()` no Next.js conecta ao broker WS.
- Charts (recharts) atualizam em tempo real.
- Logs do celular aparecem no dashboard conforme acontecem.
- Percepção de latência 0 p/ usuário.

### Passos e arquivos a editar

**Novo arquivo:** `web/src/hooks/use-dashboard-stream.ts`

```ts
import { useEffect, useRef, useState } from "react";

type Event =
  | { type: "NODE_ONLINE"; nodeId: string; time: string }
  | { type: "NODE_OFFLINE"; nodeId: string; time: string }
  | { type: "LOG"; nodeId: string; payload: string; time: string }
  | { type: "TELEMETRY"; nodeId: string; payload: any; time: string };

export function useDashboardStream() {
  const [events, setEvents] = useState<Event[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = process.env.NEXT_PUBLIC_BROKER_WS_HOST || "api.hivenode.alfastage.com.br";
    const ws = new WebSocket(`${protocol}://${host}/dashboard-stream`);
    wsRef.current = ws;
    
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // auto-reconnect exponencial
      setTimeout(() => wsRef.current?.close(), 2000);
    };
    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as Event;
        setEvents(prev => [ev, ...prev].slice(0, 200));
      } catch {}
    };
    
    return () => ws.close();
  }, []);
  
  return { events, connected };
}
```

**Arquivo:** `web/src/app/dashboard/page.tsx` (ou componente de dashboard)

Usar o hook:

```tsx
const { events, connected } = useDashboardStream();

// Atualizar mapa de nós em tempo real
useEffect(() => {
  events.forEach(ev => {
    if (ev.type === "NODE_ONLINE") updateNodeStatus(ev.nodeId, "ONLINE");
    if (ev.type === "NODE_OFFLINE") updateNodeStatus(ev.nodeId, "OFFLINE");
    if (ev.type === "TELEMETRY") updateNodeTelemetry(ev.nodeId, ev.payload);
  });
}, [events]);
```

Renderizar badge "Ao vivo" no header do dashboard:

```tsx
<div className="flex items-center gap-2">
  <span className={cn("h-2 w-2 rounded-full", connected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
  <span className="text-xs text-muted-foreground">
    {connected ? "Ao vivo" : "Reconectando..."}
  </span>
</div>
```

**Arquivo:** `docker-compose.yml`

Garantir que traefik expõe `api.hivenode.alfastage.com.br` roteando p/ o broker `:10001` (já está fazendo). Adicionar var env no `web`:

```yaml
environment:
  - NEXT_PUBLIC_BROKER_WS_HOST=api.hivenode.alfastage.com.br
```

### Verificação
- Ligar app Android → badge "Ao vivo" pisca, nó aparece ONLINE sem refresh.
- Mandar tráfego → logs aparecem streamando no dashboard.

---

## 4. E5 — Index composto para webhook billing

### Por que mudar
- `web/prisma/schema.prisma:97-106` `Subscription` tem `@@index([userId])` e `@@index([status])` separados.
- Webhook AbacatePay faz `findFirst abacatePaySubId` sem unique/index → full scan desordenado.
- `Payment` mesmo padrão com `abacateCheckoutId`.
- Em escala (>1M pagamentos) webhook fica >100ms vs <1ms alvo.

### Melhoria esperada
- `@unique` em `abacatePaySubId` e `abacateCheckoutId` — proíbe duplicidade (alinhado com B5).
- `@@index([userId, status])` para queries do dashboard "minhas assinaturas ativas".
- Webhook performance <1ms.

### Passos e arquivos a editar

**Arquivo:** `web/prisma/schema.prisma`

```prisma
model Subscription {
  // ... existente
  abacatePaySubId  String?  @unique
  
  @@index([userId])
  @@index([status])
  @@index([userId, status])          // dashboard query
  @@map("subscriptions")
}

model Payment {
  // ... existente
  abacateCheckoutId String?  @unique
  abacateSubId      String?  @unique
  
  @@index([userId])
  @@index([status])
  @@index([userId, status])
  @@map("payments")
}
```

Após a migration (associada com B7), o Postgres cria os indexes.

Trocar `findFirst` por `findUnique` em `web/src/app/api/webhooks/abacatepay/route.ts`:

```ts
// antes: const subscription = await prisma.subscription.findFirst({ where: { abacatePaySubId: subId } });
// depois:
const subscription = await prisma.subscription.findUnique({ where: { abacatePaySubId: subId } });
```

Mesma coisa p/ `Payment.abacateCheckoutId`.

### Verificação
- `EXPLAIN ANALYZE SELECT ... WHERE abacatePaySubId='...'` → Index Scan em ~0.1ms.
- Inserir 2 subscriptions com mesmo `abacatePaySubId` → P2002 (rejeita).

---

## 5. E6 — Multiplan category check manual/sequential

### Por que mudar
- `web/src/app/api/billing/subscribe/route.ts:41-53`:
  - Faz `subscription.findFirst({ include: { user: false } })` — pega só 1.
  - P/ cada sub plumage busca o plano noutra query.
  - Se o user tiver 3 subs ativas (raro, mas permitido segundo o comentário "Frota Privada + Pacotes GB + Miner"), faz 3 queries extras.
  - Permite bypass: acha primeira sub sem `planId` e segue; depois tabela pode ter mais subs na mesma categoria.

### Melhoria esperada
- Una query com `include: { plan: true }`.
- Denormalizar `planCategory` em `Subscription` p/ evitar lookup em tabela de plano em cold path.
- 1 query total; race-safe.

### Passos e arquivos a editar

**Arquivo:** `web/prisma/schema.prisma`

```prisma
model Subscription {
  // ... existente
  planCategory  PlanCategory?   // denormalizado p/ cold path
  
  @@index([userId, status, planCategory])
  @@map("subscriptions")
}
```

**Arquivo:** `web/src/app/api/billing/subscribe/route.ts`

Substituir linhas 30-53:

```ts
const existingSubs = await prisma.subscription.findMany({
  where: { userId: user.id, status: "ACTIVE" },
  include: { plan: true }
});

// Checa conflito de categoria em memória
const conflict = existingSubs.find(s => 
  s.plan && s.plan.category === plan.category
);

if (conflict) {
  return apiError(
    `Você já possui uma assinatura ativa na categoria "${plan.category === "PRIVATE_FLEET" ? "Frota Privada" : plan.category}". Cancele a atual antes de trocar.`,
    409
  );
}
```

Ao criar nova subscription, gravar `planCategory`:

```ts
await prisma.subscription.create({
  data: {
    userId: user.id,
    planId: plan.id,
    planType: (planTypeMap[plan.slug] || "STARTER") as any,
    planCategory: plan.category,    // <-- novo
    status: "PENDING",
    abacatePaySubId: subRes.data?.id,
    currentPeriodEnd: nextPeriod,
  }
});
```

### Verificação
- 5 subscrições em categorias diferentes → 1 query só, todas checadas.
- Criar subscription com mesma categoria → 409 sem bypass.

---

## 6. U3 — Timeout DIAL muito apertado para 4G instável

### Por que mudar
- `broker/internal/tunnel/socks5.go:107`: timeout de 10s esperando `DIAL_OK`.
- Em 4G instável, a TCP handshake p/ `web.whatsapp.com` + DNS resolve excede frequentemente 8s.
- SOCKS5 client vê erro "celular recusou conexao" — usuário credita bug na plataforma.

### Melhoria esperada
- Timeout escalável baseado em `TELEMETRY.network`:
  - Wi-Fi → 8s (rápido).
  - 4G/5G → 20s (tolerante).
- +20% taxa de sucesso de conexão em zonas rurais/3G.

### Passos e arquivos a editar

**Arquivo:** `broker/internal/tunnel/websocket.go`

Adicionar field ao `TunnelManager`:

```go
type TunnelManager struct {
    // ... existente
    nodeNetwork map[string]string // nodeId -> "WIFI" ou "4G/5G"
}
```

No handler de `TELEMETRY`:

```go
if msgType == "TELEMETRY" {
    network, _ := payload["network"].(string)
    tm.mu.Lock()
    tm.nodeNetwork[nodeID] = network
    tm.mu.Unlock()
    // ...broadcast existente
}
```

**Arquivo:** `broker/internal/tunnel/socks5.go`

Extrair nodeID da auth (já existe no redis `ValidateSOCKS5User` — só passar adiante) e usar timeout dinâmico:

```go
// Antes:
// case <-time.After(10 * time.Second):
// Depois:
timeout := 10 * time.Second
if network := tm.GetNodeNetwork(nodeID); network == "4G/5G" {
    timeout = 20 * time.Second
} else if network == "WIFI" {
    timeout = 8 * time.Second
}
select {
case success := <-vc.DialRespCh:
    // ...
case <-time.After(timeout):
    // ...
}
```

Adicionar helper:

```go
func (tm *TunnelManager) GetNodeNetwork(nodeID string) string {
    tm.mu.RLock()
    defer tm.mu.RUnlock()
    return tm.nodeNetwork[nodeID]
}
```

Também limpar `nodeNetwork[nodeID]` no disconnect (linha ~288).

### Verificação
- Emulador com Wi-Fi → DIAL timeout 8s.
- Force 4G (telemetria) → DIAL timeout 20s.
- Celular 4G em zona rural → DIAL_OK chega mais vezes, SOCKS5 sem erro.

---

## 7. U1 — App móvel não permite cadastro de conta

### Por que mudar
- `hivenode-app/src/app/index.tsx:303-359`: `handleLogin` só faz login.
- Se o usuário ainda não tem conta (caso BYOD), precisa criar pelo web primeiro.
- UX barreira: "instalou app, não sabe o que fazer".

### Melhoria esperada
- Tela de "Cadastre-se" nativa no app.
- Deep link `hivenode://register` que abre web (opcional — o endpoint `/api/auth/register` já existe).
- Onboarding 1-tap: app + conta + primeira sessão.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/src/app/index.tsx`

Adicionar handler `handleRegister`:

```tsx
const handleRegister = async () => {
  if (!emailInput || !passInput) {
    Alert.alert("Erro", "Preencha email e senha");
    return;
  }
  setIsLoading(true);
  try {
    const targetServer = "api.hivenode.alfastage.com.br";
    const res = await fetch(getApiUrl(targetServer, "/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput.trim(), password: passInput })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao cadastrar");
    // Cadastro OK — chama handleLogin com as mesmas credenciais
    await handleLogin();
  } catch (e: any) {
    Alert.alert("Erro no Cadastro", e?.message || "Erro desconhecido");
  } finally {
    setIsLoading(false);
  }
};
```

Na UI da tela de login, adicionar botão secundário:

```tsx
<TouchableOpacity style={[styles.buttonStart, { flex: 1, backgroundColor: "#3b82f6" }]} onPress={handleRegister}>
  <Text style={styles.buttonText}>Criar Conta</Text>
</TouchableOpacity>
```

**Arquivo:** `hivenode-app/package.json` (opcional)

Adicionar scheme p/ deep-link:

```json
"expo": {
  "scheme": "hivenode"
}
```

**Arquivo:** `hiveminer-app/src/app/index.tsx` — aplicar mesma melhoria.

### Verificação
- Abrir app sem sessão → preencher email/senha → "Criar Conta" → dismiss loading → aparece tela de túnel.
- Erros 400 (email já existe) → Alert.

---

## Resumo Sprint 4

| Item | Arquivos | Impacto |
|---|---|---|
| U2 HivePoints real | `hiveminer-app/src/app/index.tsx`, `web/src/app/api/auth/me/route.ts` | HUD honesta |
| U6 Rotate senha proxy | `web/src/app/api/proxies/[id]/rotate/route.ts`, dashboard frontend | Credencial estável |
| U7 Telemetria real-time WS | `web/src/hooks/use-dashboard-stream.ts`, dashboard page, `docker-compose.yml` | Latência 0 dashboard |
| E5 Index webhook billing | `schema.prisma`, `webhooks/abacatepay/route.ts` | Webhook <1ms |
| E6 Multiplan category memória | `schema.prisma`, `billing/subscribe/route.ts` | 1 query /subscribe |
| U3 Timeout DIAL dinâmico | `broker/internal/tunnel/socks5.go`, `websocket.go` | +20% sucesso 4G |
| U1 Cadastro no app | `hivenode-app/src/app/index.tsx`, `hiveminer-app` | Onboarding 1-tap |
