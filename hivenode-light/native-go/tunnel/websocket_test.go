package tunnel

import (
	"context"
	"github.com/gorilla/websocket"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func takePeer(t *testing.T, peers <-chan *websocket.Conn) *websocket.Conn {
	t.Helper()
	select {
	case peer := <-peers:
		return peer
	case <-time.After(5 * time.Second):
		t.Fatal("connection timeout")
		return nil
	}
}
func startTestClient(t *testing.T) (*Client, <-chan *websocket.Conn, <-chan error) {
	t.Helper()
	peers := make(chan *websocket.Conn, 4)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		peer, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err == nil {
			peers <- peer
		}
	}))
	t.Cleanup(server.Close)
	client := NewClient("ws"+strings.TrimPrefix(server.URL, "http"), "device", []byte("secret"), nil)
	done := make(chan error, 1)
	go func() { done <- client.Start(context.Background()) }()
	t.Cleanup(client.Stop)
	return client, peers, done
}
func TestReconnectAndStop(t *testing.T) {
	client, peers, done := startTestClient(t)
	first := takePeer(t, peers)
	first.Close()
	second := takePeer(t, peers)
	defer second.Close()
	if !strings.HasPrefix(client.Status(), "ONLINE") {
		t.Fatal(client.Status())
	}
	client.Stop()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Stop left Start blocked")
	}
	if client.Status() != "OFFLINE" {
		t.Fatal(client.Status())
	}
}
func TestKickDoesNotReconnect(t *testing.T) {
	client, peers, done := startTestClient(t)
	peer := takePeer(t, peers)
	defer peer.Close()
	peer.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1000, "KICKED"))
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("KICKED did not stop")
	}
	select {
	case <-peers:
		t.Fatal("reconnected after revocation")
	case <-time.After(1100 * time.Millisecond):
	}
	if client.Status() != "OFFLINE" {
		t.Fatal(client.Status())
	}
}
func TestPrivateDestinationAndInvalidPort(t *testing.T) {
	_, peers, _ := startTestClient(t)
	peer := takePeer(t, peers)
	defer peer.Close()
	for _, host := range []string{"127.0.0.1:80", "[::ffff:127.0.0.1]:80", "100.64.0.1:80", "example.org:0", "invalid"} {
		peer.WriteJSON(map[string]string{"type": "DIAL", "connId": "test", "host": host})
		peer.SetReadDeadline(time.Now().Add(2 * time.Second))
		var message map[string]string
		if err := peer.ReadJSON(&message); err != nil {
			t.Fatal(err)
		}
		if message["type"] != "DIAL_ERR" {
			t.Fatalf("%s accepted: %v", host, message)
		}
	}
}
func TestPublicIP(t *testing.T) {
	for _, ip := range []string{"0.0.0.1", "127.0.0.1", "10.0.0.1", "100.64.0.1", "::1", "::ffff:10.0.0.1", "fd00::1"} {
		if publicIP(net.ParseIP(ip)) {
			t.Fatal("private IP accepted", ip)
		}
	}
	for _, ip := range []string{"8.8.8.8", "2606:4700:4700::1111"} {
		if !publicIP(net.ParseIP(ip)) {
			t.Fatal("public IP rejected", ip)
		}
	}
}
