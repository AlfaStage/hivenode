package tunnel

import (
    "context"
    "io"
    "log"

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
