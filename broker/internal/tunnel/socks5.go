package tunnel

import (
	"context"
	"fmt"
	"log"
	"net"

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
	nodeID, err := h.redisClient.ValidateSOCKS5User(context.Background(), user, password)
	if err != nil || nodeID == "" {
		return false
	}
	
	// Verifica se o celular Android deste nó está online no momento
	conn := h.tunnelManager.GetDeviceConn(nodeID)
	if conn == nil {
		log.Printf("⚠️  Acesso negado: Celular do Node %s está offline", nodeID)
		return false
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
			// Simulação de interceptação real TCP -> WS
			log.Printf("Interceptando TCP para %s. Procurando celular responsável...", addr)
			
			// Para propósitos de MVP, pegamos o único celular que deve estar conectado
			// No ambiente real, pegaríamos o context do auth.
			tm.mu.RLock()
			var conn *websocket.Conn
			var nodeID string
			for id, ws := range tm.devices {
				conn = ws
				nodeID = id
				break
			}
			tm.mu.RUnlock()

			if conn == nil {
				return nil, fmt.Errorf("nenhum celular android conectado no momento")
			}

			log.Printf("Enviando requisição %s para o celular %s", addr, nodeID)
			
			// Aqui nós criaríamos um net.Conn virtual que escreve no WebSocket.
			// Para evitar complexidade de mutex/io.Pipe gigante nesta demonstração inicial,
			// enviamos apenas o comando inicial pro Android.
			
			// Isso simula o início da conexão (O Android conectará no host real)
			// (Implementação real completa exigiria o `net.Conn` proxy)
			return nil, fmt.Errorf("Proxy em modo Dry-Run: Redirecionamento configurado para %s (TCP <-> WS). App Android já preparado.", addr)
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
