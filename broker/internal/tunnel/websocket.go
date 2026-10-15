package tunnel

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hivenode/broker/internal/redis"
)

type Identity struct {
	ProxyID string `json:"proxyId"`
	UserID  string `json:"userId"`
	NodeID  string `json:"nodeId"`
	Metered bool   `json:"metered"`
}
type BroadcastEvent struct {
	Type    string      `json:"type"`
	NodeID  string      `json:"nodeId"`
	Payload interface{} `json:"payload"`
	Time    string      `json:"time"`
	UserID  string      `json:"-"`
}
type Device struct {
	id, userID, visibility string
	ws                     *websocket.Conn
	mu                     sync.Mutex
	done                   chan struct{}
	once                   sync.Once
}

func (d *Device) send(kind int, payload []byte) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return d.ws.WriteMessage(kind, payload)
}
func (d *Device) json(payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return d.send(websocket.TextMessage, data)
}
func (d *Device) binary(id string, payload []byte) error {
	data := make([]byte, 1+len(id)+len(payload))
	data[0] = byte(len(id))
	copy(data[1:], id)
	copy(data[1+len(id):], payload)
	return d.send(websocket.BinaryMessage, data)
}
func (d *Device) close() { d.once.Do(func() { close(d.done); d.ws.Close() }) }

type stream struct {
	id       string
	identity Identity
	device   *Device
	tm       *TunnelManager
	data     chan []byte
	dial     chan bool
	done     chan struct{}
	once     sync.Once
}

func (s *stream) close() {
	s.once.Do(func() {
		close(s.done)
		s.tm.mu.Lock()
		delete(s.tm.streams, s.id)
		s.tm.mu.Unlock()
		s.device.json(map[string]string{"type": "CLOSE", "connId": s.id})
	})
}

type dashboard struct {
	device *Device
	userID string
	admin  bool
}
type TunnelManager struct {
	redisClient            *redis.Client
	mu                     sync.RWMutex
	devices                map[string]*Device
	streams                map[string]*stream
	dashboards             map[*websocket.Conn]*dashboard
	webURL, internalSecret string
	client                 *http.Client
	allowPrivate           bool
}

func NewTunnelManager(client *redis.Client) *TunnelManager {
	return &TunnelManager{redisClient: client, devices: map[string]*Device{}, streams: map[string]*stream{}, dashboards: map[*websocket.Conn]*dashboard{},
		webURL: strings.TrimRight(os.Getenv("WEB_API_URL"), "/"), internalSecret: os.Getenv("BROKER_INTERNAL_SECRET"), client: &http.Client{Timeout: 10 * time.Second},
		allowPrivate: os.Getenv("ALLOW_PRIVATE_TARGETS") == "true" && os.Getenv("APP_ENV") == "test"}
}
func PublicIP(ip net.IP) bool {
	return ip.IsGlobalUnicast() && !ip.IsPrivate() && !ip.IsLoopback() && !ip.IsLinkLocalUnicast() &&
		!(ip.To4() != nil && (ip.To4()[0] == 0 || (ip.To4()[0] == 100 && ip.To4()[1] >= 64 && ip.To4()[1] <= 127)))
}

func (tm *TunnelManager) api(ctx context.Context, path string, body interface{}, out interface{}) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, "POST", tm.webURL+path, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+tm.internalSecret)
	request.Header.Set("Content-Type", "application/json")
	response, err := tm.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("API %s: %d", path, response.StatusCode)
	}
	if out == nil {
		return nil
	}
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1048576)).Decode(&envelope); err != nil {
		return err
	}
	return json.Unmarshal(envelope.Data, out)
}
func uuid() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 15) | 64
	b[8] = (b[8] & 63) | 128
	h := hex.EncodeToString(b)
	return h[:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:]
}
func (tm *TunnelManager) device(id string) *Device {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	return tm.devices[id]
}
func (tm *TunnelManager) openStream(d *Device, identity Identity, host string) (*stream, error) {
	tm.mu.Lock()
	count := 0
	for _, s := range tm.streams {
		if s.device == d {
			count++
		}
	}
	if count >= 64 {
		tm.mu.Unlock()
		return nil, fmt.Errorf("device capacity reached")
	}
	s := &stream{id: uuid(), identity: identity, device: d, tm: tm, data: make(chan []byte, 32), dial: make(chan bool, 1), done: make(chan struct{})}
	tm.streams[s.id] = s
	tm.mu.Unlock()
	if err := d.json(map[string]string{"type": "DIAL", "connId": s.id, "host": host}); err != nil {
		s.close()
		return nil, err
	}
	select {
	case ok := <-s.dial:
		if ok {
			return s, nil
		}
	case <-time.After(20 * time.Second):
	case <-d.done:
	}
	s.close()
	return nil, fmt.Errorf("dial failed")
}

// Each authorized chunk has one durable id. Retrying never charges a chunk twice.
func (tm *TunnelManager) charge(s *stream, rx, tx int) error {
	event := map[string]interface{}{"id": uuid(), "proxyId": s.identity.ProxyID, "nodeId": s.identity.NodeID, "bytesRx": rx, "bytesTx": tx}
	var err error
	for attempt := 0; attempt < 2; attempt++ {
		err = tm.api(context.Background(), "/api/internal/usage", event, nil)
		if err == nil {
			return nil
		}
	}
	return err
}
func (tm *TunnelManager) HandleWS(w http.ResponseWriter, r *http.Request) {
	var auth struct {
		NodeID     string `json:"nodeId"`
		UserID     string `json:"userId"`
		Visibility string `json:"visibility"`
	}
	if err := tm.api(r.Context(), "/api/internal/node-auth", map[string]string{"nodeId": r.URL.Query().Get("nodeId"), "sig": r.URL.Query().Get("sig"), "timestamp": r.URL.Query().Get("ts")}, &auth); err != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return r.Header.Get("Origin") == "" }}
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	d := &Device{id: auth.NodeID, userID: auth.UserID, visibility: auth.Visibility, ws: ws, done: make(chan struct{})}
	tm.mu.Lock()
	old := tm.devices[d.id]
	tm.devices[d.id] = d
	tm.mu.Unlock()
	if old != nil {
		old.close()
	}
	defer func() {
		d.close()
		tm.mu.Lock()
		current := tm.devices[d.id] == d
		if current {
			delete(tm.devices, d.id)
		}
		pending := []*stream{}
		for _, s := range tm.streams {
			if s.device == d {
				pending = append(pending, s)
			}
		}
		tm.mu.Unlock()
		for _, s := range pending {
			s.close()
		}
		if current {
			if tm.redisClient != nil {
				tm.redisClient.Del(context.Background(), "node:online:"+d.id)
			}
			tm.Broadcast(BroadcastEvent{Type: "NODE_OFFLINE", NodeID: d.id, UserID: d.userID})
		}
	}()
	ws.SetReadLimit(1024 * 1024)
	ws.SetReadDeadline(time.Now().Add(75 * time.Second))
	ws.SetPongHandler(func(string) error { return ws.SetReadDeadline(time.Now().Add(75 * time.Second)) })
	heartbeat := func() {
		if tm.redisClient != nil {
			tm.redisClient.Set(context.Background(), "node:online:"+d.id, d.userID, 75*time.Second)
		}
	}
	heartbeat()
	tm.Broadcast(BroadcastEvent{Type: "NODE_ONLINE", NodeID: d.id, UserID: d.userID})
	go func() {
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-d.done:
				return
			case <-ticker.C:
				if d.send(websocket.PingMessage, nil) != nil {
					d.close()
					return
				}
				heartbeat()
			}
		}
	}()
	for {
		kind, data, err := ws.ReadMessage()
		if err != nil {
			return
		}
		if kind == websocket.BinaryMessage {
			if len(data) < 2 {
				continue
			}
			length := int(data[0])
			if length == 0 || len(data) < 1+length {
				continue
			}
			id := string(data[1 : 1+length])
			tm.mu.RLock()
			s := tm.streams[id]
			tm.mu.RUnlock()
			if s == nil || s.device != d {
				continue
			}
			payload := append([]byte(nil), data[1+length:]...)
			select {
			case s.data <- payload:
			case <-s.done:
			default:
				s.close()
			}
			continue
		}
		var message struct {
			Type    string      `json:"type"`
			ConnID  string      `json:"connId"`
			Payload interface{} `json:"payload"`
			Network string      `json:"network"`
			Battery float64     `json:"battery"`
			Uptime  int64       `json:"uptime"`
		}
		if json.Unmarshal(data, &message) != nil {
			continue
		}
		if message.Type == "PING" {
			ws.SetReadDeadline(time.Now().Add(75 * time.Second))
			continue
		}
		if message.Type == "TELEMETRY" {
			tm.Broadcast(BroadcastEvent{Type: "TELEMETRY", NodeID: d.id, UserID: d.userID, Payload: map[string]interface{}{"network": message.Network, "battery": message.Battery, "uptime": message.Uptime}})
			continue
		}
		if message.Type == "LOG" {
			continue
		} // Never broadcast destination logs.
		tm.mu.RLock()
		s := tm.streams[message.ConnID]
		tm.mu.RUnlock()
		if s == nil || s.device != d {
			continue
		}
		switch message.Type {
		case "DIAL_OK", "DIAL_ERR":
			select {
			case s.dial <- message.Type == "DIAL_OK":
			default:
			}
		case "CLOSE":
			s.close()
		}
	}
}
func (tm *TunnelManager) Broadcast(event BroadcastEvent) {
	event.Time = time.Now().UTC().Format(time.RFC3339)
	tm.mu.RLock()
	clients := []*dashboard{}
	for _, c := range tm.dashboards {
		if c.admin || c.userID == event.UserID {
			clients = append(clients, c)
		}
	}
	tm.mu.RUnlock()
	for _, c := range clients {
		if c.device.json(event) != nil {
			c.device.close()
		}
	}
}
func (tm *TunnelManager) HandleDashboard(w http.ResponseWriter, r *http.Request) {
	if tm.redisClient == nil {
		http.Error(w, "Unavailable", 503)
		return
	}
	ticket := r.URL.Query().Get("ticket")
	if len(ticket) != 64 {
		http.Error(w, "Unauthorized", 401)
		return
	}
	raw, err := tm.redisClient.GetDel(r.Context(), "dashboard:ticket:"+ticket).Result()
	if err != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	var auth struct {
		UserID string `json:"userId"`
		Role   string `json:"role"`
	}
	if json.Unmarshal([]byte(raw), &auth) != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	origin := os.Getenv("WEB_ORIGIN")
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return origin != "" && r.Header.Get("Origin") == origin }}
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	d := &Device{ws: ws, done: make(chan struct{})}
	tm.mu.Lock()
	tm.dashboards[ws] = &dashboard{device: d, userID: auth.UserID, admin: auth.Role == "ADMIN"}
	tm.mu.Unlock()
	defer func() { d.close(); tm.mu.Lock(); delete(tm.dashboards, ws); tm.mu.Unlock() }()
	ws.SetReadLimit(1024)
	ws.SetReadDeadline(time.Now().Add(10 * time.Minute))
	for {
		if _, _, err := ws.ReadMessage(); err != nil {
			return
		}
	}
}
func (tm *TunnelManager) Revoke(proxyID, nodeID, userID string) {
	tm.mu.RLock()
	pending := []*stream{}
	devices := []*Device{}
	for _, s := range tm.streams {
		if s.identity.ProxyID == proxyID && proxyID != "" || s.identity.UserID == userID && userID != "" || s.device.id == nodeID && nodeID != "" {
			pending = append(pending, s)
		}
	}
	for _, d := range tm.devices {
		if nodeID != "" && d.id == nodeID || userID != "" && d.userID == userID {
			devices = append(devices, d)
		}
	}
	tm.mu.RUnlock()
	for _, s := range pending {
		s.close()
	}
	for _, d := range devices {
		d.send(websocket.CloseMessage, websocket.FormatCloseMessage(1000, "KICKED"))
		d.close()
	}
}
func (tm *TunnelManager) Rename(nodeID, name string) {
	if d := tm.device(nodeID); d != nil {
		d.json(map[string]string{"type": "NODE_RENAMED", "newName": name})
		tm.Broadcast(BroadcastEvent{Type: "NODE_RENAMED", NodeID: nodeID, UserID: d.userID, Payload: name})
	}
}
