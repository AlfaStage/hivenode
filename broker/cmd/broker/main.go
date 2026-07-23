package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/hivenode/broker/internal/config"
	"github.com/hivenode/broker/internal/redis"
	"github.com/hivenode/broker/internal/tunnel"
	"github.com/gorilla/websocket"
)

func main() {
	log.Println("🚀 Iniciando HiveNode Broker...")

	// 1. Carregar configurações
	cfg := config.Load()

	// 2. Conectar ao Redis
	redisClient, err := redis.NewClient(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Falha crítica: não foi possível conectar ao Redis: %v", err)
	}

	// 3. Inicializar Tunnel Manager (Gerencia os WebSockets dos Androids)
	tunnelManager := tunnel.NewTunnelManager(redisClient)

	// 4. Subir API HTTP do Broker (para Healthcheck e WebSockets)
	mux := http.NewServeMux()
	
	// Rota de Healthcheck
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	
	// Rota de Conexão do App Android (Túnel WebSocket)
	mux.HandleFunc("/tunnel", tunnelManager.HandleWS)

	// Rota Interna para Chutar Aparelho
	mux.HandleFunc("/kick", func(w http.ResponseWriter, r *http.Request) {
		nodeID := r.URL.Query().Get("nodeId")
		if nodeID != "" {
			tunnelManager.KickDevice(nodeID)
		}
		w.WriteHeader(http.StatusOK)
	})

	// Rota Interna para verificar Aparelhos Online
	mux.HandleFunc("/live-nodes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		nodes := tunnelManager.GetConnectedNodes()
		if err := json.NewEncoder(w).Encode(nodes); err != nil {
			http.Error(w, "encode error", http.StatusInternalServerError)
		}
	})

	// Rota WebSocket de Transmissão em Tempo Real para o Painel Web (Next.js)
	mux.HandleFunc("/dashboard-stream", func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("Erro ao abrir Dashboard Stream:", err)
			return
		}
		tunnelManager.AddDashboardClient(conn)
		log.Println("📡 Novo Painel Web escutando o Broadcaster!")

		go func() {
			defer func() {
				tunnelManager.RemoveDashboardClient(conn)
				conn.Close()
			}()
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					break
				}
			}
		}()
	})

	// Webhook Interno (chamado pelo Next.js) para orquestrar mudança de nome
	mux.HandleFunc("/internal/rename-node", func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			NodeID  string `json:"nodeId"`
			NewName string `json:"newName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// 1. Avisa os Painéis Web Abertos (Broadcaster)
		tunnelManager.BroadcastChan <- tunnel.BroadcastEvent{
			Type:    "NODE_RENAMED",
			NodeID:  payload.NodeID,
			Payload: payload.NewName,
			Time:    time.Now().Format("15:04:05"),
		}

		// 2. Avisa o Android Específico (Via Túnel Privado WS)
		conn := tunnelManager.GetDeviceConn(payload.NodeID)
		if conn != nil {
			// Envia mensagem silenciosa de UI pro Celular
			conn.WriteJSON(map[string]interface{}{
				"type": "NODE_RENAMED",
				"newName": payload.NewName,
			})
		}

		w.WriteHeader(http.StatusOK)
	})

	go func() {
		log.Printf("📡 API do Broker (WS Tunnel) escutando na porta %s...", cfg.TunnelPort)
		if err := http.ListenAndServe("0.0.0.0:"+cfg.TunnelPort, mux); err != nil {
			log.Fatalf("Erro na API do Broker: %v", err)
		}
	}()

	// 5. Subir o Proxy SOCKS5
	tunnel.StartSocks5Server(cfg.Socks5Port, redisClient, tunnelManager)
}
