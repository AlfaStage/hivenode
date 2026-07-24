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
