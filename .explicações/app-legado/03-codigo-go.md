# 03 — Código Go do núcleo (gomobile bind)

> Aqui mora toda a lógica de rede. É uma **adaptação** de `broker/internal/tunnel/websocket.go` para lado-cliente. Quem knows Go lê em 30 min; quem não sabe Go pode copiar os snippets e adaptar conforme as referências.

## 0. Estrutura final dos arquivos

```
android/legacy/native-go/
├── go.mod
├── tunnel/
│   ├── protocol.go    # constantes e tipos do protocolo (espelho broker)
│   ├── websocket.go   # cliente WS — equivalente inverso de broker HandleWS
│   ├── socks.go       # recebe "DIAL dest" → abre TCP real
│   ├── resolver.go    # DNS w/ cache LRU TTL 5min
│   └── pump.go         # io.Copy bidirecional
├── stats/
│   └── counter.go      # conta bytes, envia TELEMETRY periodica
├── auth/
│   └── hmac.go         # HMAC-SHA256 sig p/ conectar WS
└── mobile/
    └── mobile.go       # API pública exposta pro Java via gomobile bind
```

## 1. `go.mod`

```go
module github.com/hivenode/legacy

go 1.21

require (
    github.com/gorilla/websocket v1.5.3
    golang.org/x/net v0.33.0
)

require golang.org/x/sys v0.46.0 // indirect
```

> Mantemos a mesma golang.org/x/net usada no broker (`broker/go.sum` já tem essa linha). `gorilla/websocket` idem.

## 2. `tunnel/protocol.go` — espelho do broker

Constantes devem bater com `broker/internal/tunnel/websocket.go`:

```go
package tunnel

// Mensagens JSON que o broker entende - versão simplificada.
// Referência: broker/internal/tunnel/websocket.go linhas 356-439.
const (
    MsgTypeDial     = "DIAL"     // broker → device: pede p/ abrir TCP em dest:port
    MsgTypeDialOK   = "DIAL_OK" // device → broker: TCP conectado
    MsgTypeDialErr  = "DIAL_ERR"// device → broker: não conseguiu conectar
    MsgTypeClose    = "CLOSE"   // qualquer lado: fecha VirtualConn
    MsgTypeLog      = "LOG"      // device → broker: log p/ painel
    MsgTypeTelemetry= "TELEMETRY"// device → broker: rx/tx/cpu/etc
)

// Formato binário (inalterável - precisa bater EXATAMENTE com broker):
//   [idLen:1byte] [connId:idLen bytes] [payload:N bytes]
// Referência: broker/internal/tunnel/websocket.go linhas 88-93 (Write) e 282-309 (leitura).
const headerIDLen = 1
```

## 3. `auth/hmac.go` — gera assinatura do WS

Mirror de `broker/internal/tunnel/websocket.go:215` e `hivedocker/server.js:48`.

```go
package auth

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
)

// SignWSURL produz a query string de assinatura para conectar ao broker.
// nodeId é o ID do device (vem do /api/nodes/register quando o usuário vincula aparelho).
// secret é "hivenode_secret_key" hoje (hardcoded no broker) OU o tunnelSecret
// por-usuario após Sprint 3 S1 (ver .explicações/melhorias-glm-5.2/03-sprint-seguranca-critica.md).
//
//emporora: broker Go define o secret em websocket.go:215.
// Após Sprint 3 S1: broker Go busca em Redis user_tunnel_secret:{nodeId}.
// Client não muda - só precisamos receber o secret do Java caller.
func BuildSig(nodeID string, secret []byte) string {
    mac := hmac.New(sha256.New, secret)
    mac.Write([]byte(nodeID))
    return hex.EncodeToString(mac.Sum(nil))
}
```

## 4. `tunnel/websocket.go` — cliente WS

Esta é uma adaptação do **lado inverso** do broker. O broker é server; nós somos client.参考: `hivedocker/server.js:43-100` (Node.js faz o equivalente).

```go
package tunnel

import (
    "context"
    "crypto/tls"
    "encoding/json"
    "errors"
    "fmt"
    "log"
    "net/http"
    "sync"
    "time"

    "github.com/gorilla/websocket"
    "github.com/hivenode/legacy/auth"
    "github.com/hivenode/legacy/stats"
)

// Client é o lado Android do túnel (apedars equidistante do broker).
type Client struct {
    brokerHost string       // ex: "broker.hivenode.alfastage.com.br"
    nodeID     string
    tunnelSecret []byte     // segredo HMAC
    stats      *stats.Counter

    mu        sync.Mutex
    ws        *websocket.Conn
    isClosed  bool
    stopCh    chan struct{}
    onDisconnect func(reason string)   // callback p/ Java (via gomobile)

    // conexões TCP ativas (por connID)
    connsMu sync.Mutex
    conns   map[string]*activeConn
}

type activeConn struct {
    connID  string
    tcpConn net.Conn
    cancel  context.CancelFunc
}

// NewClient devolve um cliente WS.
func NewClient(brokerHost, nodeID string, secret []byte, onDisconnect func(string)) *Client {
    return &Client{
        brokerHost:    brokerHost,
        nodeID:        nodeID,
        tunnelSecret:  secret,
        stats:         stats.NewCounter(),
        stopCh:        make(chan struct{}),
        conns:         make(map[string]*activeConn),
        onDisconnect: onDisconnect,
    }
}

// connect dispara a conexão WS com retry exponencial.
// Referência do broker endpoint: broker/cmd/broker/main.go:40 -- mux.HandleFunc("/tunnel", HandleWS).
func (c *Client) connect(ctx context.Context) error {
    sig := auth.BuildSig(c.nodeID, c.tunnelSecret)
    url := fmt.Sprintf("wss://%s/tunnel?nodeId=%s&sig=%s", c.brokerHost, c.nodeID, sig)

    dialer := websocket.Dialer{
        TLSClientConfig:  &tls.Config{MinVersion: tls.VersionTLS12},
        HandshakeTimeout: 10 * time.Second,
        ReadBufferSize:   32 * 1024, // == broker
        WriteBufferSize:  32 * 1024,
    }

    conn, _, err := dialer.DialContext(ctx, url, http.Header{})
    if err != nil {
        return err
    }

    c.mu.Lock()
    c.ws = conn
    c.mu.Unlock()

    go c.readLoop(ctx)
    go c.pingLoop(ctx)
    return nil
}

// Start entrada principal - tem retry com backoff.
// O usuario (Java) chama via gomobile Start(host, nodeID, secret).
func (c *Client) Start(ctx context.Context) error {
    backoff := 1 * time.Second
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-c.stopCh:
            return errors.New("stopped")
        default:
        }

        err := c.connect(ctx)
        if err == nil {
            log.Printf("ligado no broker %s como nodeId=%s", c.brokerHost, c.nodeID)
            <-ctx.Done() // espera cancelamento
            backoff = 1 * time.Second
            continue
        }
        log.Printf("erro connect: %v - retry em %v", err, backoff)
        // jitter +/- 30%
        jitter := time.Duration(rand.Int63n(int64(backoff) * 30 / 100))
        time.Sleep(backoff + jitter)
        if backoff < 30*time.Second {
            backoff *= 2
        }
    }
}

// pingLoop envia ping 60s p/ detectar conexões mortas mesmo em 3G que caiu.
func (c *Client) pingLoop(ctx context.Context) {
    ticker := time.NewTicker(60 * time.Second)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            c.mu.Lock()
            if c.ws != nil {
                _ = c.ws.WriteMessage(websocket.PingMessage, nil)
            }
            c.mu.Unlock()
        }
    }
}

// readLoop processa mensagens do broker.
// 2 tipos:
//   - BinaryMessage: [idLen][connId][payload] - dados TCP do SOCKS5 client.
//   - TextMessage (JSON): DIAL, CLOSE, etc.
// Referência: broker/internal/tunnel/websocket.go linhas 273-438 (lado server).
func (c *Client) readLoop(ctx context.Context) {
    for {
        c.mu.Lock()
        ws := c.ws
        c.mu.Unlock()
        if ws == nil {
            return
        }

        msgType, msg, err := ws.ReadMessage()
        if err != nil {
            log.Printf("WS read erro: %v", err)
            c.cleanupConns()
            if c.onDisconnect != nil {
                c.onDisconnect(err.Error())
            }
            return
        }

        switch msgType {
        case websocket.BinaryMessage:
            c.handleBinary(msg)
        case websocket.TextMessage:
            c.handleControl(msg)
        }
    }
}

// handleBinary recebe [idLen][connId][payload] e escreve no TCP real.
// Espelho de hivedocker/server.js linhas 56-66.
func (c *Client) handleBinary(msg []byte) {
    if len(msg) < headerIDLen {
        return
    }
    idLen := int(msg[0])
    if len(msg) < headerIDLen+idLen {
        return
    }
    connID := string(msg[headerIDLen : headerIDLen+idLen])
    payload := msg[headerIDLen+idLen:]

    c.connsMu.Lock()
    ac, ok := c.conns[connID]
    c.connsMu.Unlock()
    if !ok {
        return // conn já fechada ou desconhecida
    }

    _, _ = ac.tcpConn.Write(payload)
    c.stats.AddRx(len(payload))
}

// handleControl parse dos JSONs.
// Referência: broker/internal/tunnel/websocket.go linhas 314-407.
func (c *Client) handleControl(msg []byte) {
    var ctrl map[string]interface{}
    if err := json.Unmarshal(msg, &ctrl); err != nil {
        return
    }
    t, _ := ctrl["type"].(string)
    connID, _ := ctrl["connId"].(string)
    switch t {
    case MsgTypeDial:
        dest, _ := ctrl["dest"].(string)
        go c.handleDial(connID, dest)
    case MsgTypeClose:
        c.closeConn(connID)
    }
}

// handleDial abre TCP destination, diz DIAL_OK/DIAL_ERR p/ broker.
// Espelho de hivedocker/server.js linhas 90-110.
func (c *Client) handleDial(connID, dest string) {
    if connID == "" || dest == "" {
        return
    }
    dialer := &net.Dialer{Timeout: 10 * time.Second}
    tcp, err := dialer.Dial("tcp", dest)
    if err != nil {
        c.sendJSON(map[string]interface{}{
            "type":    MsgTypeDialErr,
            "connId":  connID,
            "reason":  err.Error(),
        })
        return
    }

    ctx, cancel := context.WithCancel(context.Background())
    ac := &activeConn{connID: connID, tcpConn: tcp, cancel: cancel}

    c.connsMu.Lock()
    c.conns[connID] = ac
    c.connsMu.Unlock()

    c.sendJSON(map[string]interface{}{
        "type":   MsgTypeDialOK,
        "connId": connID,
    })

    go c.pump(ctx, ac)
}

func (c *Client) sendJSON(m map[string]interface{}) {
    c.mu.Lock()
    defer c.mu.Unlock()
    if c.ws != nil {
        _ = c.ws.WriteJSON(m)
    }
}

func (c *Client) closeConn(connID string) {
    c.connsMu.Lock()
    ac, ok := c.conns[connID]
    if ok {
        delete(c.conns, connID)
    }
    c.connsMu.Unlock()
    if ok {
        ac.cancel()
        ac.tcpConn.Close()
        // Informa broker
        c.sendJSON(map[string]interface{}{
            "type":   MsgTypeClose,
            "connId": connID,
        })
    }
}

func (c *Client) cleanupConns() {
    c.connsMu.Lock()
    defer c.connsMu.Unlock()
    for id, ac := range c.conns {
        ac.cancel()
        ac.tcpConn.Close()
        delete(c.conns, id)
    }
}

// Stop encerra tudo.
func (c *Client) Stop() {
    select {
    case <-c.stopCh:
    default:
        close(c.stopCh)
    }
    c.cleanupConns()
    c.mu.Lock()
    if c.ws != nil {
        _ = c.ws.Close()
        c.ws = nil
    }
    c.mu.Unlock()
}

// Status retorna string legivel p/ Java chamar e mostrar na UI.
func (c *Client) Status() string {
    c.mu.Lock()
    online := c.ws != nil
    c.mu.Unlock()
    if online {
        return fmt.Sprintf("ONLINE rx=%d tx=%d conns=%d",
            c.stats.Rx(), c.stats.Tx(), c.numConns())
    }
    return "OFFLINE"
}

func (c *Client) numConns() int {
    c.connsMu.Lock()
    defer c.connsMu.Unlock()
    return len(c.conns)
}
```

## 5. `tunnel/pump.go` — io.Copy TCP→WS

```go
package tunnel

import (
    "context"
    "io"
    "net"
    "github.com/gorilla/websocket"
)

// pump lee do TCP real e manda p/ o broker via WS no formato binário.
// Espelho do lado server: broker/internal/tunnel/websocket.go VirtualConn.Write linhas 79-119.
func (c *Client) pump(ctx context.Context, ac *activeConn) {
    buf := make([]byte, 32*1024) // mesmo tamanho broker
    for {
        select {
        case <-ctx.Done():
            return
        default:
        }
        n, err := ac.tcpConn.Read(buf)
        if n > 0 {
            payload := make([]byte, n)
            copy(payload, buf[:n])
            c.writeBinary(ac.connID, payload)
            c.stats.AddTx(n)
        }
        if err != nil {
            if err != io.EOF {
                log.Printf("pump read erro: %v", err)
            }
            c.closeConn(ac.connID)
            return
        }
    }
}

// writeBinary monta [idLen][connId][payload] e envia via WebSocket BinaryMessage.
// Formato Identico a broker: websocket.go linhas 87-94.
func (c *Client) writeBinary(connID string, payload []byte) {
    idBytes := []byte(connID)
    out := make([]byte, 1+len(idBytes)+len(payload))
    out[0] = byte(len(idBytes))
    copy(out[1:], idBytes)
    copy(out[1+len(idBytes):], payload)

    c.mu.Lock()
    defer c.mu.Unlock()
    if c.ws != nil {
        _ = c.ws.WriteMessage(websocket.BinaryMessage, out)
    }
}
```

## 6. `tunnel/resolver.go` — cache DNS LRU

```go
package tunnel

import (
    "sync"
    "time"
    "net"
    "sync/atomic"
)

// Em Android antigo, cada dial TCP faz DNS resolve de novo. No 3G isso é caro.
// Cache LRU simples com TTL 5 min e 100 entradas.

type dnsCacheEntry struct {
    ips      []net.IP
    expiresAt time.Time
}

type DNSCache struct {
    mu     sync.Mutex
    cache  map[string]dnsCacheEntry
    hits   uint64
    misses uint64
}

func NewDNSCache() *DNSCache {
    return &DNSCache{cache: make(map[string]dnsCacheEntry)}
}

// Resolve tenta cache; cai p/ net.LookupIP.
func (d *DNSCache) Resolve(host string) ([]net.IP, error) {
    d.mu.Lock()
    if e, ok := d.cache[host]; ok && time.Now().Before(e.expiresAt) {
        atomic.AddUint64(&d.hits, 1)
        d.mu.Unlock()
        return e.ips, nil
    }
    d.mu.Unlock()

    atomic.AddUint64(&d.misses, 1)
    ips, err := net.LookupIP(host)
    if err != nil {
        return nil, err
    }

    d.mu.Lock()
    // Evict oldest se cache > 100
    if len(d.cache) > 100 {
        for k := range d.cache {
            delete(d.cache, k)
            break
        }
    }
    d.cache[host] = dnsCacheEntry{
        ips:       ips,
        expiresAt: time.Now().Add(5 * time.Minute),
    }
    d.mu.Unlock()
    return ips, nil
}

// Stats retorna hits/misses p/ Telemetry.
func (d *DNSCache) Stats() (uint64, uint64) {
    return atomic.LoadUint64(&d.hits), atomic.LoadUint64(&d.misses)
}
```

> **Atenção**: o `dialer.Dial("tcp", dest)` no `websocker.go` acima já usa `net.Dial` que faz DNS resolve. Para integrar o cache, subclassifique o Dialer: `Dialer.Control` hook p/ interceptar e fazer cache lookup. Ver exercício abaixo. **Sem cache funciona, com cache aguenta melhor em 3G.**

### Exercício para integrar DNSCache (opcional)

Substituir `dialer.Dial("tcp", dest)` por função custom que quebra `host:port`, resolve via cache, e diala IP direto:

```go
// em tunnel/socks.go
func (c *Client) dialer() (*net.Dialer, netResolver) {
    return &net.Dialer{Timeout: 10 * time.Second}, c.dns
}
// no handleDial:
host, port, _ := net.SplitHostPort(dest)
ips, err := c.dns.Resolve(host)
if err != nil { ... dial err ... }
ip := ips[rand.Intn(len(ips))]
tcp, err := dialer.Dial("tcp", net.JoinHostPort(ip.String(), port))
```

## 7. `stats/counter.go` — contagem

```go
package stats

import "sync/atomic"

type Counter struct {
    rx uint64
    tx uint64
}

func NewCounter() *Counter { return &Counter{} }

func (c *Counter) AddRx(n int) { atomic.AddUint64(&c.rx, uint64(n)) }
func (c *Counter) AddTx(n int) { atomic.AddUint64(&c.tx, uint64(n)) }

func (c *Counter) Rx() uint64 { return atomic.LoadUint64(&c.rx) }
func (c *Counter) Tx() uint64 { return atomic.LoadUint64(&c.tx) }
```

> Broker usa um `NodeStats` por device (broker websocket.go linhas 51-53, 305-309). O Android aggrega por device antes de mandar telemetry pra economizar pacotes.

## 8. `mobile/mobile.go` — API para Java

gomobile bind gera classes Java apenas para tipos exportados em um package-main principal. Tudo precisa ser capitalizado.

```go
package mobile

import (
    "context"
    "runtime"
    "sync"
    "time"

    "github.com/hivenode/legacy/tunnel"
    "github.com/hivenode/legacy/stats"
)

// Tunnel é a fachada importada pelo Java. Vira br/alfastage/hivenode/legacy/Tunnel.java.
type Tunnel struct {
    mu          sync.Mutex
    client      *tunnel.Client
    ctx         context.Context
    cancel      context.CancelFunc
    statusCB    StatusCallback // gomobile: declara interface aqui
}

// StatusCallback é interface chamada quando status muda.
// Em Java: new StatusCallback() { public void onStatus(String s) { ... } }
type StatusCallback interface {
    OnStatus(status string)
}

var globalTunnel *Tunnel

// NewTunnel exposto via Mobile.NewTunnel() -
// Instância singleton mantém compatibilidade com Service que reusa.
func NewTunnel() *Tunnel {
    runtime.GOMAXPROCS(2)
    // Limita heap Go a 32 MB - livra RAM p/ TV Box usar Netflix no resto
    // (em Go 1.21+ SetMemoryLimit é a forma moderna)
    runtime.SetMemoryLimit(32 << 20)
    runtime.SetGCPercent(50)
    t := &Tunnel{}
    globalTunnel = t
    return t
}

// Start exposto como t.Start(brokerHost, nodeID, tunnelSecret).
// tunnelSecret é "hivenode_secret_key" hoje; pós Sprint 3 S1 vem do JWT.
func (t *Tunnel) Start(brokerHost, nodeID, tunnelSecret string) error {
    t.mu.Lock()
    defer t.mu.Unlock()
    if t.client != nil {
        return nil // já running
    }

    ctx, cancel := context.WithCancel(context.Background())
    t.ctx = ctx
    t.cancel = cancel

    onDisconnect := func(reason string) {
        if t.statusCB != nil {
            t.statusCB.OnStatus("DISCONNECTED: " + reason)
        }
    }

    c := tunnel.NewClient(brokerHost, nodeID, []byte(tunnelSecret), onDisconnect)
    t.client = c

    go func() {
        if err := c.Start(ctx); err != nil {
            log.Printf("client stopped: %v", err)
        }
        if t.statusCB != nil {
            t.statusCB.OnStatus("STOPPED")
        }
    }()
    return nil
}

// Stop exposto como t.Stop()
func (t *Tunnel) Stop() {
    t.mu.Lock()
    defer t.mu.Unlock()
    if t.cancel != nil {
        t.cancel()
        t.cancel = nil
    }
    if t.client != nil {
        t.client.Stop()
        t.client = nil
    }
}

// Status exposto como t.Status() string
func (t *Tunnel) Status() string {
    t.mu.Lock()
    defer t.mu.Unlock()
    if t.client == nil {
        return "STOPPED"
    }
    return t.client.Status()
}

// SetStatusCallback permite Java registrar callback para mudanças de estado
func (t *Tunnel) SetStatusCallback(cb StatusCallback) {
    t.mu.Lock()
    t.statusCB = cb
    t.mu.Unlock()
}

// RxBytes exposto p/ Java mostrar na UI
func (t *Tunnel) RxBytes() int64 {
    t.mu.Lock()
    defer t.mu.Unlock()
    if t.client == nil {
        return 0
    }
    return int64(t.client.Stats().Rx())
}

// TxBytes idem
func (t *Tunnel) TxBytes() int64 {
    t.mu.Lock()
    defer t.mu.Unlock()
    if t.client == nil {
        return 0
    }
    return int64(t.client.Stats().Tx())
}

// SendTelemetry empurra mensagem TELEMETRY p/ broker a cada 30s.
// Optional - Java pode chamar via TimerTask.
func (t *Tunnel) SendTelemetry(ipAddr, networkType string) {
    t.mu.Lock()
    defer t.mu.Unlock()
    if t.client == nil {
        return
    }
    t.client.SendTelemetry(ipAddr, networkType)
}
```

> **Adicione em tunnel/websocket.go** (Client) os helpers:
> ```go
> func (c *Client) Stats() *stats.Counter { return c.stats }
> func (c *Client) SendTelemetry(ip, network string) {
>     c.sendJSON(map[string]interface{}{
>         "type":    MsgTypeTelemetry,
>         "ip":      ip,
>         "network": network,
>         "rx":      c.stats.Rx(),
>         "tx":      c.stats.Tx(),
>         "ts":      time.Now().Format(time.RFC3339),
>     })
> }
> ```

## 9. Build via gomobile bind

Dentro do container (`android/legacy`):

```bash
cd native-go
go mod tidy
gomobile bind -target=android/arm,android/arm64,android/386 -androidapi=16 -javapkg=br.alfastage.hivenode.legacy -o ../android-app/app/libs/libhivenode.aar ./mobile
```

- `-target=android/arm,android/arm64,android/386` gera 3 ABIs (armeabi-v7a, arm64-v8a, x86).
- `-androidapi=16` alvo mínimo — roda em Android 4.1+.
- `-javapkg` coloca classes no package Java correto.
- Output é um `.aar` que o Gradle importará no passo Android.

**Resultado esperado**: `android-app/app/libs/libhivenode.aar` (~3 MB).

## 10. Verificação rápida

Dentro do container, ainda em `native-go`:

```bash
go vet ./...
go build ./mobile    # deve compilar sem erro
```

Se aparecerem erros de import, rode `go mod tidy` e confirme que `go.mod` acima está idêntico.

## 11. Próximo passo

→ [04-codigo-android-java.md](./04-codigo-android-java.md) para criar o shell que usa o `libhivenode.aar`.
