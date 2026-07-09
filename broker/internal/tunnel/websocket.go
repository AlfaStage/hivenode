package tunnel

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// BroadcastEvent representa um pacote de tempo real enviado para o Painel Web
type BroadcastEvent struct {
	Type    string      `json:"type"` // "NODE_ONLINE", "NODE_OFFLINE", "LOG"
	NodeID  string      `json:"nodeId"`
	Payload interface{} `json:"payload"`
	Time    string      `json:"time"`
}

// TunnelManager gerencia as conexões WebSocket dos devices Android e do Painel
type TunnelManager struct {
	upgrader         websocket.Upgrader
	devices          map[string]*websocket.Conn
	dashboardClients map[*websocket.Conn]bool
	virtualConns     map[string]*VirtualConn
	mu               sync.RWMutex
	BroadcastChan    chan BroadcastEvent
}

// VirtualConn implementa net.Conn enviando dados pelo WebSocket do Android
type VirtualConn struct {
	ConnID  string
	NodeID  string
	TM      *TunnelManager
	ReadCh  chan []byte
	CloseCh chan struct{}
	closed  bool
	mu      sync.Mutex
	buffer  []byte
}

func (vc *VirtualConn) Read(b []byte) (n int, err error) {
	if len(vc.buffer) > 0 {
		n = copy(b, vc.buffer)
		vc.buffer = vc.buffer[n:]
		return n, nil
	}
	select {
	case data := <-vc.ReadCh:
		if data == nil {
			return 0, io.EOF
		}
		n = copy(b, data)
		if n < len(data) {
			vc.buffer = data[n:]
		}
		return n, nil
	case <-vc.CloseCh:
		return 0, io.EOF
	}
}

func (vc *VirtualConn) Write(b []byte) (n int, err error) {
	vc.mu.Lock()
	if vc.closed {
		vc.mu.Unlock()
		return 0, io.ErrClosedPipe
	}
	vc.mu.Unlock()

	encoded := base64.StdEncoding.EncodeToString(b)
	msg := map[string]interface{}{
		"type":   "DATA",
		"connId": vc.ConnID,
		"data":   encoded,
	}

	vc.TM.mu.RLock()
	ws, ok := vc.TM.devices[vc.NodeID]
	vc.TM.mu.RUnlock()

	if !ok {
		return 0, io.EOF
	}

	vc.TM.mu.Lock()
	err = ws.WriteJSON(msg)
	vc.TM.mu.Unlock()

	if err != nil {
		return 0, err
	}
	return len(b), nil
}

func (vc *VirtualConn) Close() error {
	vc.mu.Lock()
	if vc.closed {
		vc.mu.Unlock()
		return nil
	}
	vc.closed = true
	close(vc.CloseCh)
	vc.mu.Unlock()

	msg := map[string]interface{}{
		"type":   "CLOSE",
		"connId": vc.ConnID,
	}

	vc.TM.mu.RLock()
	ws, ok := vc.TM.devices[vc.NodeID]
	vc.TM.mu.RUnlock()

	if ok {
		vc.TM.mu.Lock()
		ws.WriteJSON(msg)
		vc.TM.mu.Unlock()
	}

	vc.TM.mu.Lock()
	delete(vc.TM.virtualConns, vc.ConnID)
	vc.TM.mu.Unlock()
	return nil
}

// Dummy impls para net.Conn
func (vc *VirtualConn) LocalAddr() net.Addr                { return &net.TCPAddr{} }
func (vc *VirtualConn) RemoteAddr() net.Addr               { return &net.TCPAddr{} }
func (vc *VirtualConn) SetDeadline(t time.Time) error      { return nil }
func (vc *VirtualConn) SetReadDeadline(t time.Time) error  { return nil }
func (vc *VirtualConn) SetWriteDeadline(t time.Time) error { return nil }

func NewTunnelManager() *TunnelManager {
	tm := &TunnelManager{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Aceitar do app Android e do Painel Web
			},
		},
		devices:          make(map[string]*websocket.Conn),
		dashboardClients: make(map[*websocket.Conn]bool),
		virtualConns:     make(map[string]*VirtualConn),
		BroadcastChan:    make(chan BroadcastEvent, 100),
		activeSockets:    make(map[string]*VirtualConn),
	}
	go tm.runBroadcaster()
	return tm
}

func (tm *TunnelManager) runBroadcaster() {
	for event := range tm.BroadcastChan {
		tm.mu.RLock()
		for client := range tm.dashboardClients {
			client.WriteJSON(event)
		}
		tm.mu.RUnlock()
	}
}

// AddDashboardClient registra um novo navegador Web escutando eventos
func (tm *TunnelManager) AddDashboardClient(conn *websocket.Conn) {
	tm.mu.Lock()
	tm.dashboardClients[conn] = true
	tm.mu.Unlock()
}

// RemoveDashboardClient remove um navegador Web desconectado
func (tm *TunnelManager) RemoveDashboardClient(conn *websocket.Conn) {
	tm.mu.Lock()
	delete(tm.dashboardClients, conn)
	tm.mu.Unlock()
}

// HandleWS é a rota /tunnel onde o App Android conecta
func (tm *TunnelManager) HandleWS(w http.ResponseWriter, r *http.Request) {
	// TODO: FASE 3 - Validar JWT no Header (Authorization: Bearer <token>)
	nodeID := r.URL.Query().Get("nodeId")
	if nodeID == "" {
		http.Error(w, "Missing nodeId", http.StatusBadRequest)
		return
	}

	conn, err := tm.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Erro ao fazer upgrade WS:", err)
		return
	}

	// Registrar o device Android
	tm.mu.Lock()
	tm.devices[nodeID] = conn
	tm.mu.Unlock()

	log.Printf("🔗 Novo Device conectado no WS: %s", nodeID)

	// Dispara o Evento de "Online" pro Painel Web
	tm.BroadcastChan <- BroadcastEvent{
		Type:    "NODE_ONLINE",
		NodeID:  nodeID,
		Payload: nil,
		Time:    time.Now().Format(time.RFC3339),
	}

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			log.Printf("❌ Device desconectado: %s", nodeID)
			tm.mu.Lock()
			delete(tm.devices, nodeID)
			tm.mu.Unlock()

			// Dispara o Evento de "Offline" pro Painel Web
			tm.BroadcastChan <- BroadcastEvent{
				Type:    "NODE_OFFLINE",
				NodeID:  nodeID,
				Payload: nil,
				Time:    time.Now().Format(time.RFC3339),
			}
			break
		}

		// Faz o parse do pacote recebido do Celular
		var payload map[string]interface{}
		if err := json.Unmarshal(msgBytes, &payload); err == nil {
			msgType, ok := payload["type"].(string)
			if ok {
				// Se o celular enviou um pacote de Telemetria (LOG)
				if msgType == "LOG" {
					tm.BroadcastChan <- BroadcastEvent{
						Type:    "LOG",
						NodeID:  nodeID,
						Payload: payload["payload"],
						Time:    time.Now().Format("15:04:05"),
					}
				} else if msgType == "TELEMETRY" {
					// Envia a saúde/rede do celular pro Dashboard
					tm.BroadcastChan <- BroadcastEvent{
						Type:    "TELEMETRY",
						NodeID:  nodeID,
						Payload: payload, // { ip: "...", network: "..." }
						Time:    time.Now().Format("15:04:05"),
					}
				} else if msgType == "DATA" {
					connId, _ := payload["connId"].(string)
					dataStr, _ := payload["data"].(string)
					if connId != "" && dataStr != "" {
						decoded, err := base64.StdEncoding.DecodeString(dataStr)
						if err == nil {
							tm.mu.RLock()
							vc, exists := tm.virtualConns[connId]
							tm.mu.RUnlock()
							if exists {
								vc.ReadCh <- decoded
							}
						}
					}
				} else if msgType == "CLOSE" || msgType == "DIAL_ERR" {
					connId, _ := payload["connId"].(string)
					if connId != "" {
						tm.mu.RLock()
						vc, exists := tm.virtualConns[connId]
						tm.mu.RUnlock()
						if exists {
							vc.Close()
						}
					}
				}
			}
		}
	}
}

// AddVirtualConn registra o túnel no TM para receber roteamento do device
func (tm *TunnelManager) AddVirtualConn(vc *VirtualConn) {
	tm.mu.Lock()
	tm.virtualConns[vc.ConnID] = vc
	tm.mu.Unlock()
}

// GetWS returns the raw websocket for dial commands
func (tm *TunnelManager) GetWS(nodeID string) *websocket.Conn {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	return tm.devices[nodeID]
}

// GetDeviceConn retorna a conexão WS do Android se estiver online
func (tm *TunnelManager) GetDeviceConn(nodeID string) *websocket.Conn {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	return tm.devices[nodeID]
}

// KickDevice derruba a conexão de um Node específico
func (tm *TunnelManager) KickDevice(nodeID string) {
	tm.mu.Lock()
	conn, exists := tm.devices[nodeID]
	if exists {
		delete(tm.devices, nodeID)
	}
	tm.mu.Unlock()

	if exists {
		// Manda uma mensagem de fechamento limpa com o motivo "KICKED"
		conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "KICKED"))
		conn.Close()
		log.Printf("🔨 Device Kickado pelo sistema: %s", nodeID)
	}
}

// GetConnectedNodes retorna a lista de IDs de todos os aparelhos conectados agora
func (tm *TunnelManager) GetConnectedNodes() []string {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	nodes := make([]string, 0, len(tm.devices))
	for id := range tm.devices {
		nodes = append(nodes, id)
	}
	return nodes
}
