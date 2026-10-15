package tunnel

import (
	"github.com/gorilla/websocket"
	"time"
)

func (c *Client) pump(ac *activeConn) {
	defer c.closeConn(ac)
	buf := make([]byte, 32*1024)
	for {
		ac.tcpConn.SetReadDeadline(time.Now().Add(2 * time.Minute))
		n, err := ac.tcpConn.Read(buf)
		if n > 0 {
			data := make([]byte, 1+len(ac.connID)+n)
			data[0] = byte(len(ac.connID))
			copy(data[1:], ac.connID)
			copy(data[1+len(ac.connID):], buf[:n])
			if ac.session.send(websocket.BinaryMessage, data) != nil {
				return
			}
			c.stats.AddTx(n)
		}
		if err != nil {
			return
		}
	}
}
