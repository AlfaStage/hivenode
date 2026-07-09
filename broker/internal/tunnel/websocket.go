package tunnel

import (
	"encoding/json"
	"log"
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
	mu               sync.RWMutex
	BroadcastChan    chan BroadcastEvent
}

func NewTunnelManager() *TunnelManager {
	tm := &TunnelManager{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Aceitar do app Android e do Painel Web
			},
		},
		devices:          make(map[string]*websocket.Conn),
		dashboardClients: make(map[*websocket.Conn]bool),
		BroadcastChan:    make(chan BroadcastEvent, 100),
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
				}
			}
		}
	}
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
