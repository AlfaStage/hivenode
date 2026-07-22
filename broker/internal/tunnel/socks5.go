package tunnel

import (
	"context"
	"fmt"
	"log"
	"net"
	"time"

	"github.com/gorilla/websocket"

	socks5 "github.com/armon/go-socks5"
	"github.com/hivenode/broker/internal/redis"
)

// HiveAuth implementa a interface socks5.CredentialStore
type HiveAuth struct {
	redisClient   *redis.Client
	tunnelManager *TunnelManager
}

func (h *HiveAuth) Valid(user, password string) bool {
	nodeID, nodeType, err := h.redisClient.ValidateSOCKS5User(context.Background(), user, password)
	if err != nil || nodeID == "" {
		return false
	}
	
	// Se for nó privado, ele DEVE estar online.
	// Se for nó público, o Broker fará o failover/round-robin na hora do Dial.
	if nodeType == "PRIVATE" {
		conn := h.tunnelManager.GetDeviceConn(nodeID)
		if conn == nil {
			log.Printf("⚠️  Acesso negado: Nó Privado %s está offline", nodeID)
			return false
		}
	}
	return true
}

// StartSocks5Server inicia o servidor na porta especificada.
func StartSocks5Server(port string, redisClient *redis.Client, tm *TunnelManager) {
	auth := socks5.UserPassAuthenticator{
		Credentials: &HiveAuth{
			redisClient:   redisClient,
			tunnelManager: tm,
		},
	}

	conf := &socks5.Config{
		AuthMethods: []socks5.Authenticator{auth},
		Logger:      log.New(log.Writer(), "[SOCKS5] ", log.LstdFlags),
		Dial: func(ctx context.Context, network, addr string) (net.Conn, error) {
			log.Printf("Interceptando TCP para %s. Preparando túnel VirtualConn...", addr)
			
			// Gera um ID simples usando nanosegundos
			connID := fmt.Sprintf("conn_%d", time.Now().UnixNano())
			// Failover Inteligente: Pega qualquer nó online (Para a Persona 3 / Público)
			// Em um sistema real, extrairíamos o Payload do ctx.
			tm.mu.RLock()
			var conn *websocket.Conn
			var nodeID string
			for id, ws := range tm.devices {
				conn = ws
				nodeID = id
				break // Round-robin simples para failover
			}
			tm.mu.RUnlock()

			if conn == nil {
				return nil, fmt.Errorf("rede global indisponível no momento")
			}

			vc := &VirtualConn{
				ConnID:     connID,
				NodeID:     nodeID,
				TM:         tm,
				ReadCh:     make(chan []byte, 1024),
				DialRespCh: make(chan bool, 1),
				CloseCh:    make(chan struct{}),
				buffer:     make([]byte, 0),
			}
			tm.AddVirtualConn(vc)

			// Envia o comando para o celular abrir a porta local com a internet
			msg := map[string]interface{}{
				"type":   "DIAL",
				"connId": connID,
				"host":   addr,
			}
			
			tm.mu.Lock()
			err := conn.WriteJSON(msg)
			tm.mu.Unlock()
			
			if err != nil {
				vc.Close()
				return nil, err
			}

			// Aguarda a confirmação do celular (DIAL_OK ou DIAL_ERR)
			select {
			case success := <-vc.DialRespCh:
				if !success {
					vc.Close()
					return nil, fmt.Errorf("celular recusou a conexao TCP para %s", addr)
				}
			case <-time.After(10 * time.Second):
				vc.Close()
				return nil, fmt.Errorf("timeout esperando celular conectar ao %s", addr)
			}

			log.Printf("Túnel TCP->WS criado para %s via celular %s (ConnID: %s)", addr, nodeID, connID)
			return vc, nil
		},
	}

	server, err := socks5.New(conf)
	if err != nil {
		log.Fatalf("Erro ao criar SOCKS5: %v", err)
	}

	log.Printf("🛡️  Servidor SOCKS5 escutando na porta %s...", port)
	if err := server.ListenAndServe("tcp", "0.0.0.0:"+port); err != nil {
		log.Fatalf("Erro SOCKS5 listen: %v", err)
	}
}
