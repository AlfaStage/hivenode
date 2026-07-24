package tunnel

import (
    "context"
    "crypto/tls"
    "encoding/json"
    "errors"
    "fmt"
    "log"
    "net"
    "net/http"
    "sync"
    "time"
    "math/rand"

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
    
    dns       *DNSCache
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
        onDisconnect:  onDisconnect,
        dns:           NewDNSCache(),
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
func (c *Client) handleDial(connID, dest string) {
    if connID == "" || dest == "" {
        return
    }
    
    // DNS resolving usando nosso cache LRU
    host, port, err := net.SplitHostPort(dest)
    if err != nil {
        host = dest
        port = "80" // default port se erro split, só p/ não quebrar
    }
    
    ips, err := c.dns.Resolve(host)
    if err != nil || len(ips) == 0 {
        c.sendJSON(map[string]interface{}{
            "type":    MsgTypeDialErr,
            "connId":  connID,
            "reason":  "dns resolve error",
        })
        return
    }
    
    ip := ips[rand.Intn(len(ips))]
    target := net.JoinHostPort(ip.String(), port)
    
    dialer := &net.Dialer{Timeout: 10 * time.Second}
    tcp, err := dialer.Dial("tcp", target)
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

func (c *Client) Stats() *stats.Counter { return c.stats }

func (c *Client) SendTelemetry(ip, network string) {
    c.sendJSON(map[string]interface{}{
        "type":    MsgTypeTelemetry,
        "ip":      ip,
        "network": network,
        "rx":      c.stats.Rx(),
        "tx":      c.stats.Tx(),
        "ts":      time.Now().Format(time.RFC3339),
    })
}
