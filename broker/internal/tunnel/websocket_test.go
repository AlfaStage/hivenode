package tunnel

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestDeviceWebSocketOrigin(t *testing.T) {
	for _, tc := range []struct {
		name, origin string
		authorized   bool
		wantStatus   int
	}{
		{"android same origin", "same", true, http.StatusSwitchingProtocols},
		{"native without origin", "", true, http.StatusSwitchingProtocols},
		{"untrusted website", "https://untrusted.example", true, http.StatusForbidden},
		{"invalid device credentials", "same", false, http.StatusUnauthorized},
	} {
		t.Run(tc.name, func(t *testing.T) {
			api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/api/internal/node-auth" {
					t.Errorf("unexpected API path: %s", r.URL.Path)
				}
				if !tc.authorized {
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`{"data":{"nodeId":"test-device","userId":"test-user","visibility":"PRIVATE"}}`))
			}))
			defer api.Close()
			tm := NewTunnelManager(nil)
			tm.webURL = api.URL
			server := httptest.NewServer(http.HandlerFunc(tm.HandleWS))
			defer server.Close()
			headers := http.Header{}
			if tc.origin == "same" {
				headers.Set("Origin", server.URL)
			} else if tc.origin != "" {
				headers.Set("Origin", tc.origin)
			}
			dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
			conn, response, err := dialer.Dial("ws"+strings.TrimPrefix(server.URL, "http")+"/tunnel", headers)
			if conn != nil {
				defer conn.Close()
			}
			if response == nil {
				t.Fatalf("no handshake response: %v", err)
			}
			defer response.Body.Close()
			if response.StatusCode != tc.wantStatus {
				t.Fatalf("handshake status = %d, want %d; error: %v", response.StatusCode, tc.wantStatus, err)
			}
			if tc.wantStatus == http.StatusSwitchingProtocols && err != nil {
				t.Fatalf("device failed to connect: %v", err)
			}
		})
	}
}
