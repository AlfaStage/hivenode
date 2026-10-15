package tunnel

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/hivenode/light/auth"
	"github.com/hivenode/light/stats"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Client struct {
	brokerHost, nodeID string
	tunnelSecret       []byte
	stats              *stats.Counter
	mu                 sync.Mutex
	session            *session
	stopCh             chan struct{}
	stopOnce           sync.Once
	onDisconnect       func(string)
	dns                *DNSCache
}

// Every pending dial and TCP stream belongs exclusively to one WebSocket session.
type session struct {
	ws      *websocket.Conn
	ctx     context.Context
	cancel  context.CancelFunc
	writeMu sync.Mutex
	connsMu sync.Mutex
	conns   map[string]*activeConn
	pending map[string]context.CancelFunc
}
type activeConn struct {
	connID  string
	tcpConn net.Conn
	session *session
}

func NewClient(host, id string, secret []byte, onDisconnect func(string)) *Client {
	return &Client{brokerHost: host, nodeID: id, tunnelSecret: secret, stats: stats.NewCounter(), stopCh: make(chan struct{}), onDisconnect: onDisconnect, dns: NewDNSCache()}
}
func (c *Client) connect(ctx context.Context) (*session, error) {
	base := strings.TrimRight(c.brokerHost, "/")
	if !strings.Contains(base, "://") {
		base = "wss://" + base
	}
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	address := base + "/tunnel?" + url.Values{"nodeId": {c.nodeID}, "ts": {timestamp}, "sig": {auth.BuildSig(c.nodeID+":"+timestamp, c.tunnelSecret)}}.Encode()
	dialer := websocket.Dialer{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12}, HandshakeTimeout: 10 * time.Second}
	ws, response, err := dialer.DialContext(ctx, address, http.Header{})
	if response != nil && response.Body != nil {
		response.Body.Close()
	}
	if err != nil {
		return nil, err
	}
	sessionCtx, cancel := context.WithCancel(ctx)
	s := &session{ws: ws, ctx: sessionCtx, cancel: cancel, conns: make(map[string]*activeConn), pending: make(map[string]context.CancelFunc)}
	ws.SetReadLimit(1048576)
	ws.SetReadDeadline(time.Now().Add(75 * time.Second))
	ws.SetPingHandler(func(payload string) error {
		ws.SetReadDeadline(time.Now().Add(75 * time.Second))
		return ws.WriteControl(websocket.PongMessage, []byte(payload), time.Now().Add(10*time.Second))
	})
	c.mu.Lock()
	select {
	case <-c.stopCh:
		c.mu.Unlock()
		s.close()
		return nil, errors.New("stopped")
	default:
	}
	c.session = s
	c.mu.Unlock()
	go func() { <-sessionCtx.Done(); ws.Close() }()
	return s, nil
}
func (c *Client) Start(ctx context.Context) error {
	defer c.Stop()
	backoff := time.Second
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-c.stopCh:
			return errors.New("stopped")
		default:
		}
		started := time.Now()
		s, err := c.connect(ctx)
		if err == nil {
			err = c.readLoop(s)
			c.mu.Lock()
			if c.session == s {
				c.session = nil
			}
			c.mu.Unlock()
			s.close()
			if c.onDisconnect != nil {
				c.onDisconnect(err.Error())
			}
			var closeError *websocket.CloseError
			if errors.As(err, &closeError) && closeError.Text == "KICKED" {
				return err
			}
			if time.Since(started) > 30*time.Second {
				backoff = time.Second
			}
		}
		timer := time.NewTimer(backoff)
		select {
		case <-timer.C:
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-c.stopCh:
			timer.Stop()
			return errors.New("stopped")
		}
		if backoff < 30*time.Second {
			backoff *= 2
			if backoff > 30*time.Second {
				backoff = 30 * time.Second
			}
		}
	}
}
func (s *session) send(kind int, data []byte) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	if s.ctx.Err() != nil {
		return s.ctx.Err()
	}
	s.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
	err := s.ws.WriteMessage(kind, data)
	if err != nil {
		s.cancel()
	}
	return err
}
func (s *session) json(message interface{}) {
	data, err := json.Marshal(message)
	if err == nil {
		s.send(websocket.TextMessage, data)
	}
}
func (s *session) close() {
	s.cancel()
	s.ws.Close()
	s.connsMu.Lock()
	defer s.connsMu.Unlock()
	for _, cancel := range s.pending {
		cancel()
	}
	for id, conn := range s.conns {
		conn.tcpConn.Close()
		delete(s.conns, id)
	}
}
func (c *Client) readLoop(s *session) error {
	for {
		kind, data, err := s.ws.ReadMessage()
		if err != nil {
			return err
		}
		s.ws.SetReadDeadline(time.Now().Add(75 * time.Second))
		if kind == websocket.BinaryMessage {
			if len(data) < 2 || data[0] == 0 || len(data) < 1+int(data[0]) {
				continue
			}
			id := string(data[1 : 1+int(data[0])])
			s.connsMu.Lock()
			ac := s.conns[id]
			s.connsMu.Unlock()
			if ac != nil {
				ac.tcpConn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				n, err := ac.tcpConn.Write(data[1+int(data[0]):])
				c.stats.AddRx(n)
				if err != nil {
					c.closeConn(ac)
				}
			}
			continue
		}
		var message map[string]string
		if json.Unmarshal(data, &message) != nil {
			continue
		}
		id := message["connId"]
		if message["type"] == MsgTypeClose {
			s.connsMu.Lock()
			ac := s.conns[id]
			cancel := s.pending[id]
			s.connsMu.Unlock()
			if cancel != nil {
				cancel()
			}
			if ac != nil {
				c.closeConn(ac)
			}
		} else if message["type"] == MsgTypeDial {
			if len(id) == 0 || len(id) > 64 {
				continue
			}
			s.connsMu.Lock()
			if s.conns[id] != nil || s.pending[id] != nil {
				s.connsMu.Unlock()
				continue
			}
			if len(s.conns)+len(s.pending) >= 64 {
				s.connsMu.Unlock()
				s.json(map[string]string{"type": MsgTypeDialErr, "connId": id})
				continue
			}
			ctx, cancel := context.WithTimeout(s.ctx, 10*time.Second)
			s.pending[id] = cancel
			s.connsMu.Unlock()
			go c.handleDial(ctx, s, id, message["host"])
		}
	}
}
func publicIP(ip net.IP) bool {
	return ip.IsGlobalUnicast() && !ip.IsPrivate() && !ip.IsLoopback() && !ip.IsLinkLocalUnicast() &&
		!(ip.To4() != nil && (ip.To4()[0] == 0 || (ip.To4()[0] == 100 && ip.To4()[1] >= 64 && ip.To4()[1] <= 127)))
}
func (c *Client) handleDial(ctx context.Context, s *session, id, dest string) {
	defer func() {
		s.connsMu.Lock()
		if cancel := s.pending[id]; cancel != nil {
			cancel()
			delete(s.pending, id)
		}
		s.connsMu.Unlock()
	}()
	fail := func() { s.json(map[string]string{"type": MsgTypeDialErr, "connId": id}) }
	host, port, err := net.SplitHostPort(dest)
	number, portErr := strconv.Atoi(port)
	if err != nil || portErr != nil || number < 1 || number > 65535 {
		fail()
		return
	}
	ips, err := c.dns.ResolveContext(ctx, host)
	if err != nil || len(ips) == 0 {
		fail()
		return
	}
	for _, ip := range ips {
		if !publicIP(ip) {
			fail()
			return
		}
	}
	tcp, err := (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, "tcp", net.JoinHostPort(ips[0].String(), port))
	if err != nil {
		fail()
		return
	}
	ac := &activeConn{connID: id, tcpConn: tcp, session: s}
	s.connsMu.Lock()
	if ctx.Err() != nil {
		s.connsMu.Unlock()
		tcp.Close()
		return
	}
	s.conns[id] = ac
	s.connsMu.Unlock()
	s.json(map[string]string{"type": MsgTypeDialOK, "connId": id})
	go c.pump(ac)
}
func (c *Client) closeConn(ac *activeConn) {
	s := ac.session
	s.connsMu.Lock()
	current := s.conns[ac.connID] == ac
	if current {
		delete(s.conns, ac.connID)
	}
	s.connsMu.Unlock()
	ac.tcpConn.Close()
	if current {
		s.json(map[string]string{"type": MsgTypeClose, "connId": ac.connID})
	}
}
func (c *Client) Stop() {
	c.stopOnce.Do(func() { close(c.stopCh) })
	c.mu.Lock()
	s := c.session
	c.session = nil
	c.mu.Unlock()
	if s != nil {
		s.close()
	}
}
func (c *Client) Status() string {
	c.mu.Lock()
	s := c.session
	c.mu.Unlock()
	if s == nil || s.ctx.Err() != nil {
		return "OFFLINE"
	}
	s.connsMu.Lock()
	count := len(s.conns)
	s.connsMu.Unlock()
	return fmt.Sprintf("ONLINE rx=%d tx=%d conns=%d", c.stats.Rx(), c.stats.Tx(), count)
}
func (c *Client) Stats() *stats.Counter { return c.stats }
func (c *Client) SendTelemetry(ip, network string) {
	c.mu.Lock()
	s := c.session
	c.mu.Unlock()
	if s != nil {
		s.json(map[string]interface{}{"type": MsgTypeTelemetry, "ip": ip, "network": network, "rx": c.stats.Rx(), "tx": c.stats.Tx()})
	}
}
