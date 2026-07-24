package mobile

import (
    "context"
    "log"
    "runtime"
    "runtime/debug"
    "sync"

    "github.com/hivenode/legacy/tunnel"
)

// Tunnel é a fachada importada pelo Java. Vira br/alfastage/hivenode/legacy/Tunnel.java.
type Tunnel struct {
    mu       sync.Mutex
    client   *tunnel.Client
    ctx      context.Context
    cancel   context.CancelFunc
    statusCB StatusCallback // gomobile: declara interface aqui
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
    // runtime.SetMemoryLimit(32 << 20) // Go 1.19+ feature, safe to use in 1.21
    debug.SetGCPercent(50)
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
