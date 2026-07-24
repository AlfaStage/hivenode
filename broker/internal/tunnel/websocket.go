package tunnel

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hivenode/broker/internal/redis"
)

var bufPool = sync.Pool{
	New: func() interface{} {
		b := make([]byte, 0, 32*1024) // 32KB default
		return &b
	},
}

const SHARD_COUNT = 64

type sharedDevices struct {
	shards [SHARD_COUNT]struct {
		mu    sync.RWMutex
		items map[string]*websocket.Conn
	}
}

func newSharedDevices() *sharedDevices {
	sd := &sharedDevices{}
	for i := range sd.shards {
		sd.shards[i].items = make(map[string]*websocket.Conn)
	}
	return sd
}

func (sd *sharedDevices) getShard(id string) *struct {
	mu    sync.RWMutex
	items map[string]*websocket.Conn
} {
	h := fnv.New32a()
	h.Write([]byte(id))
	return &sd.shards[h.Sum32()%SHARD_COUNT]
}

func (sd *sharedDevices) Set(id string, conn *websocket.Conn) {
	s := sd.getShard(id)
	s.mu.Lock()
	s.items[id] = conn
	s.mu.Unlock()
}

func (sd *sharedDevices) Get(id string) (*websocket.Conn, bool) {
	s := sd.getShard(id)
	s.mu.RLock()
	c, ok := s.items[id]
	s.mu.RUnlock()
	return c, ok
}

func (sd *sharedDevices) Delete(id string) {
	s := sd.getShard(id)
	s.mu.Lock()
	delete(s.items, id)
	s.mu.Unlock()
}

func (sd *sharedDevices) Len() int {
	count := 0
	for i := range sd.shards {
		sd.shards[i].mu.RLock()
		count += len(sd.shards[i].items)
		sd.shards[i].mu.RUnlock()
	}
	return count
}

func (sd *sharedDevices) Range(f func(id string, conn *websocket.Conn) bool) {
	for i := range sd.shards {
		s := &sd.shards[i]
		s.mu.RLock()
		for k, v := range s.items {
			if !f(k, v) {
				s.mu.RUnlock()
				return
			}
		}
		s.mu.RUnlock()
	}
}

// BroadcastEvent representa um pacote de tempo real enviado para o Painel Web
type BroadcastEvent struct {
	Type    string      `json:"type"` // "NODE_ONLINE", "NODE_OFFLINE", "LOG"
	NodeID  string      `json:"nodeId"`
	Payload interface{} `json:"payload"`
	Time    string      `json:"time"`
}

// TunnelManager gerencia as conexões WebSocket dos devices Android e do Painel
type TunnelManager struct {
	redisClient      *redis.Client
	upgrader         websocket.Upgrader
	devices          *sharedDevices
	dashboardClients map[*websocket.Conn]bool
	virtualConns     map[string]*VirtualConn
	nodeStats        map[string]*NodeStats
	minerIPCounts    map[string]int
	proxyIPCounts    map[string]int
	nodeNetwork      map[string]string // nodeId -> "WIFI" ou "4G/5G"
	mu               sync.RWMutex
	BroadcastChan    chan BroadcastEvent
}

type NodeStats struct {
	Rx uint64
	Tx uint64
}

// VirtualConn implementa net.Conn enviando dados pelo WebSocket do Android
type VirtualConn struct {
	ConnID     string
	NodeID     string
	TM         *TunnelManager
	ReadCh     chan []byte
	DialRespCh chan bool
	CloseCh    chan struct{}
	closed     bool
	mu         sync.Mutex
	buffer     []byte
	rxLocal    atomic.Uint64
	txLocal    atomic.Uint64
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
			vc.buffer = data[n:] // cópia só quando parcial
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

	idBytes := []byte(vc.ConnID)
	bufPtr := bufPool.Get().(*[]byte)
	defer bufPool.Put(bufPtr)

	needed := 1 + len(idBytes) + len(b)
	if cap(*bufPtr) < needed {
		*bufPtr = make([]byte, needed)
	}
	out := (*bufPtr)[:needed]

	out[0] = byte(len(idBytes))
	copy(out[1:], idBytes)
	copy(out[1+len(idBytes):], b)

	ws, ok := vc.TM.devices.Get(vc.NodeID)
	vc.TM.mu.RLock()
	stats, statsOk := vc.TM.nodeStats[vc.NodeID]
	vc.TM.mu.RUnlock()

	if statsOk {
		newRx := vc.rxLocal.Add(uint64(len(b)))
		if newRx >= 5*1024*1024 { // 5MB
			// reset local and add to global
			atomic.AddUint64(&stats.Rx, newRx)
			vc.rxLocal.Store(0)
		}
	}

	if !ok {
		return 0, io.EOF
	}

	// Removido lock global (vc.TM.mu) em volta de ws.WriteMessage para evitar gargalo de performance
	vc.mu.Lock()
	err = ws.WriteMessage(websocket.BinaryMessage, out)
	vc.mu.Unlock()

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

	ws, ok := vc.TM.devices.Get(vc.NodeID)
	if ok {
		vc.mu.Lock()
		ws.WriteJSON(msg)
		vc.mu.Unlock()
	}

	vc.TM.mu.Lock()
	if stats, exists := vc.TM.nodeStats[vc.NodeID]; exists {
		atomic.AddUint64(&stats.Rx, vc.rxLocal.Load())
		atomic.AddUint64(&stats.Tx, vc.txLocal.Load())
	}
	delete(vc.TM.virtualConns, vc.ConnID)
	vc.TM.mu.Unlock()
	return nil
}

// Dummy impls para net.Conn
func (vc *VirtualConn) LocalAddr() net.Addr                { return &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 10000} }
func (vc *VirtualConn) RemoteAddr() net.Addr               { return &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 10000} }
func (vc *VirtualConn) SetDeadline(t time.Time) error      { return nil }
func (vc *VirtualConn) SetReadDeadline(t time.Time) error  { return nil }
func (vc *VirtualConn) SetWriteDeadline(t time.Time) error { return nil }

func NewTunnelManager(rClient *redis.Client) *TunnelManager {
	tm := &TunnelManager{
		redisClient: rClient,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Aceitar do app Android e do Painel Web
			},
		},
		devices:          newSharedDevices(),
		dashboardClients: make(map[*websocket.Conn]bool),
		virtualConns:     make(map[string]*VirtualConn),
		nodeStats:        make(map[string]*NodeStats),
		minerIPCounts:    make(map[string]int),
		proxyIPCounts:    make(map[string]int),
		nodeNetwork:      make(map[string]string),
		BroadcastChan:    make(chan BroadcastEvent, 100),
	}
	go tm.runBroadcaster()
	go tm.startRedisBroadcast()
	return tm
}

// Broadcast envia o evento para o Pub/Sub Redis (escala horizontalmente)
func (tm *TunnelManager) Broadcast(ev BroadcastEvent) {
	// Publica no Redis para que outros brokers (caso haja) também recebam
	data, _ := json.Marshal(ev)
	tm.redisClient.Publish(context.Background(), "broker:broadcast", data)
}

func (tm *TunnelManager) broadcastLocal(ev BroadcastEvent) {
	tm.mu.RLock()
	for client := range tm.dashboardClients {
		client.WriteJSON(ev)
	}
	tm.mu.RUnlock()
}

func (tm *TunnelManager) runBroadcaster() {
	// Apenas escuta os canais locais (ainda suportados) e repassa para broadcastLocal
	for event := range tm.BroadcastChan {
		tm.broadcastLocal(event)
	}
}

func (tm *TunnelManager) startRedisBroadcast() {
	sub := tm.redisClient.Subscribe(context.Background(), "broker:broadcast")
	ch := sub.Channel()
	for msg := range ch {
		var ev BroadcastEvent
		if err := json.Unmarshal([]byte(msg.Payload), &ev); err == nil {
			tm.broadcastLocal(ev) // manda pros dashboards conectados neste broker
		}
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

func (tm *TunnelManager) getTunnelSecret(nodeID string) ([]byte, error) {
	secret, err := tm.redisClient.Get(context.Background(), "user_tunnel_secret:"+nodeID).Result()
	if err != nil || secret == "" {
		return nil, fmt.Errorf("tunnel secret não encontrado para node %s", nodeID)
	}
	return []byte(secret), nil
}

func (tm *TunnelManager) HandleWS(w http.ResponseWriter, r *http.Request) {
	nodeID := r.URL.Query().Get("nodeId")
	sig := r.URL.Query().Get("sig") // Assinatura Criptográfica

	if nodeID == "" || sig == "" {
		http.Error(w, "Missing nodeId or sig", http.StatusBadRequest)
		return
	}

	// 1. Proteção Anti-Fraude: Validar Assinatura HMAC com segredo do usuário
	secret, err := tm.getTunnelSecret(nodeID)
	if err != nil {
		http.Error(w, "Tunnel secret unavailable", http.StatusServiceUnavailable)
		return
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(nodeID))
	expectedMAC := hex.EncodeToString(mac.Sum(nil))

	if sig != expectedMAC {
		log.Printf("⚠️ FRAUDE DETECTADA: Assinatura HMAC/SHA256 inválida (IP: %s)", r.RemoteAddr)
		http.Error(w, "Invalid Signature", http.StatusUnauthorized)
		return
	}

	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		if idx := strings.LastIndex(r.RemoteAddr, ":"); idx != -1 {
			ip = r.RemoteAddr[:idx]
		} else {
			ip = r.RemoteAddr
		}
	} else {
		ip = strings.Split(ip, ",")[0]
	}

	visibility, err := tm.redisClient.Get(context.Background(), "node_visibility:"+nodeID).Result()
	if err != nil {
		visibility = "PRIVATE"
	}

	tm.mu.Lock()
	if visibility == "PUBLIC" {
		if tm.minerIPCounts[ip] >= 1 {
			tm.mu.Unlock()
			log.Printf("⛔ RATE LIMIT: IP %s já possui 1 HiveMiner conectado.", ip)
			http.Error(w, "Max 1 Miner per IP", http.StatusForbidden)
			return
		}
		tm.minerIPCounts[ip]++
	} else {
		if tm.proxyIPCounts[ip] >= 10 {
			tm.mu.Unlock()
			log.Printf("⛔ RATE LIMIT: IP %s atingiu limite de 10 HiveNodes.", ip)
			http.Error(w, "Max 10 Nodes per IP", http.StatusForbidden)
			return
		}
		tm.proxyIPCounts[ip]++
	}
	tm.mu.Unlock()

	conn, err := tm.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Erro ao fazer upgrade WS:", err)
		return
	}

	// Registrar o device Android
	tm.devices.Set(nodeID, conn)
	tm.mu.Lock()
	if _, exists := tm.nodeStats[nodeID]; !exists {
		tm.nodeStats[nodeID] = &NodeStats{}
	}
	tm.mu.Unlock()

	const (
		pingInterval = 30 * time.Second
		pongWait     = 45 * time.Second
	)

	_ = conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				tm.mu.Lock()
				err := conn.WriteMessage(websocket.PingMessage, nil)
				tm.mu.Unlock()
				if err != nil {
					return
				}
			}
		}
	}()

	// Sincronizar com Redis para leitura via GET /api/nodes
	if err := tm.redisClient.SAdd(context.Background(), "hivenode:online_nodes", nodeID).Err(); err != nil {
		log.Printf("⚠️ Erro ao registrar node no Redis (SAdd): %v", err)
	}

	log.Printf("🔗 Novo Device conectado no WS: %s", nodeID)

	// Dispara o Evento de "Online" pro Painel Web via Redis Broadcast
	tm.Broadcast(BroadcastEvent{
		Type:    "NODE_ONLINE",
		NodeID:  nodeID,
		Payload: nil,
		Time:    time.Now().Format(time.RFC3339),
	})

	for {
		msgTypeRaw, msgBytes, err := conn.ReadMessage()
		if err != nil {
			log.Printf("❌ Device desconectado: %s", nodeID)
			
			tm.devices.Delete(nodeID)
			if err := tm.redisClient.SRem(context.Background(), "hivenode:online_nodes", nodeID).Err(); err != nil {
				log.Printf("⚠️ Erro ao remover node no Redis (SRem): %v", err)
			}
			
			tm.mu.Lock()
			stats, statsOk := tm.nodeStats[nodeID]
			
			if visibility == "PUBLIC" {
				tm.minerIPCounts[ip]--
				if tm.minerIPCounts[ip] <= 0 {
					delete(tm.minerIPCounts, ip)
				}
			} else {
				tm.proxyIPCounts[ip]--
				if tm.proxyIPCounts[ip] <= 0 {
					delete(tm.proxyIPCounts, ip)
				}
			}
			delete(tm.nodeNetwork, nodeID)
			tm.mu.Unlock()

			// Contabilização de Tráfego: Mandar para o Redis para o Worker de Pontos processar
			if statsOk && (stats.Tx > 0 || stats.Rx > 0) {
				payload := fmt.Sprintf("%s:%d:%d", nodeID, stats.Tx, stats.Rx)
				tm.redisClient.RPush(context.Background(), "traffic_logs", payload)
				log.Printf("💰 Tráfego salvo no Ledger Buffer (Redis): %s", payload)
			}

			// Dispara o Evento de "Offline" pro Painel Web
			tm.Broadcast(BroadcastEvent{
				Type:    "NODE_OFFLINE",
				NodeID:  nodeID,
				Payload: nil,
				Time:    time.Now().Format(time.RFC3339),
			})
			break
		}

		// Verifica se a mensagem é um pacote TCP Binário
		if msgTypeRaw == websocket.BinaryMessage {
			if len(msgBytes) > 1 {
				idLen := int(msgBytes[0])
				if len(msgBytes) >= 1+idLen {
					connId := string(msgBytes[1 : 1+idLen])
					payload := msgBytes[1+idLen:]

					tm.mu.RLock()
					vc, exists := tm.virtualConns[connId]
					stats, statsOk := tm.nodeStats[nodeID]
					tm.mu.RUnlock()

					if statsOk {
						if exists {
							newTx := vc.txLocal.Add(uint64(len(payload)))
							if newTx >= 5*1024*1024 {
								atomic.AddUint64(&stats.Tx, newTx)
								vc.txLocal.Store(0)
							}
						} else {
							atomic.AddUint64(&stats.Tx, uint64(len(payload)))
						}
					}

					if exists {
						vc.ReadCh <- payload
					}
				}
			}
			continue
		}

		// Faz o parse do pacote recebido do Celular (Controle/JSON)
		var payload map[string]interface{}
		if err := json.Unmarshal(msgBytes, &payload); err == nil {
			msgType, ok := payload["type"].(string)
			if ok {
				if msgType == "PING" {
					continue
				}
				// Se o celular enviou um pacote de Telemetria (LOG)
				if msgType == "LOG" {
					tm.Broadcast(BroadcastEvent{
						Type:    "LOG",
						NodeID:  nodeID,
						Payload: payload["payload"],
						Time:    time.Now().Format("15:04:05"),
					})
				} else if msgType == "TELEMETRY" {
					network, _ := payload["network"].(string)
					
					tm.mu.Lock()
					tm.nodeNetwork[nodeID] = network
					stats, statsOk := tm.nodeStats[nodeID]
					tm.mu.Unlock()

					if statsOk {
						payload["rx"] = atomic.LoadUint64(&stats.Rx)
						payload["tx"] = atomic.LoadUint64(&stats.Tx)
					}

					// Envia a saúde/rede do celular pro Dashboard
					tm.Broadcast(BroadcastEvent{
						Type:    "TELEMETRY",
						NodeID:  nodeID,
						Payload: payload,
						Time:    time.Now().Format("15:04:05"),
					})
				} else if msgType == "DIAL_OK" {
					connId, _ := payload["connId"].(string)
					if connId != "" {
						tm.mu.RLock()
						vc, exists := tm.virtualConns[connId]
						tm.mu.RUnlock()
						if exists {
							select {
							case vc.DialRespCh <- true:
							default:
							}
						}
					}
				} else if msgType == "DIAL_ERR" {
					connId, _ := payload["connId"].(string)
					if connId != "" {
						tm.mu.RLock()
						vc, exists := tm.virtualConns[connId]
						tm.mu.RUnlock()
						if exists {
							select {
							case vc.DialRespCh <- false:
							default:
							}
							vc.Close()
						}
					}
				} else if msgType == "CLOSE" {
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

	// Inicia o flush periódico dos bytes locais para o global a cada 30s (BillingFlushSecs)
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				vc.mu.Lock()
				closed := vc.closed
				vc.mu.Unlock()
				if closed {
					return
				}

				tm.mu.RLock()
				stats, statsOk := tm.nodeStats[vc.NodeID]
				tm.mu.RUnlock()

				if statsOk {
					rx := vc.rxLocal.Swap(0)
					if rx > 0 {
						atomic.AddUint64(&stats.Rx, rx)
					}
					tx := vc.txLocal.Swap(0)
					if tx > 0 {
						atomic.AddUint64(&stats.Tx, tx)
					}
				}
			case <-vc.CloseCh:
				return
			}
		}
	}()
}

// GetWS returns the raw websocket for dial commands
func (tm *TunnelManager) GetWS(nodeID string) *websocket.Conn {
	ws, _ := tm.devices.Get(nodeID)
	return ws
}

// GetDeviceConn retorna a conexão WS do Android se estiver online
func (tm *TunnelManager) GetDeviceConn(nodeID string) *websocket.Conn {
	ws, _ := tm.devices.Get(nodeID)
	return ws
}

// KickDevice derruba a conexão de um Node específico
func (tm *TunnelManager) KickDevice(nodeID string) {
	conn, exists := tm.devices.Get(nodeID)
	if exists {
		tm.devices.Delete(nodeID)
		if err := tm.redisClient.SRem(context.Background(), "hivenode:online_nodes", nodeID).Err(); err != nil {
			log.Printf("⚠️ Erro ao remover node no Redis no KickDevice (SRem): %v", err)
		}
		conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "KICKED"))
		conn.Close()
		log.Printf("🔨 Device Kickado pelo sistema: %s", nodeID)
	}
}

// GetConnectedNodes retorna a lista de IDs de todos os aparelhos conectados agora
func (tm *TunnelManager) GetConnectedNodes() []string {
	var nodes []string
	tm.devices.Range(func(id string, conn *websocket.Conn) bool {
		nodes = append(nodes, id)
		return true
	})
	return nodes
}

// GetNodeNetwork retorna o tipo de rede reportado pelo nó
func (tm *TunnelManager) GetNodeNetwork(nodeID string) string {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	return tm.nodeNetwork[nodeID]
}
