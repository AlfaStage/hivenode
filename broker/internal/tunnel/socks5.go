package tunnel

import (
 "context"
 "encoding/binary"
 "fmt"
 "io"
 "log"
 "net"
 "strconv"
 "time"

 "github.com/hivenode/broker/internal/redis"
)

// SOCKS5 CONNECT only. The destination name is preserved for DNS at the device.
func StartSocks5Server(port string, _ *redis.Client, tm *TunnelManager) {
 listener, err := net.Listen("tcp", ":"+port)
 if err != nil { log.Fatal(err) }
 if err := tm.ServeSOCKS(listener); err != nil { log.Print(err) }
}

func (tm *TunnelManager) ServeSOCKS(listener net.Listener) error {
 slots := make(chan struct{}, 512)
 for {
  conn, err := listener.Accept()
  if err != nil { return err }
  select {
  case slots <- struct{}{}:
   go func() { defer func(){ <-slots }(); tm.handleSOCKS(conn) }()
  default: conn.Close()
  }
 }
}

func readSized(c net.Conn) (string, error) {
 var length [1]byte
 if _, err := io.ReadFull(c, length[:]); err != nil { return "", err }
 if length[0] == 0 { return "", fmt.Errorf("empty value") }
 data := make([]byte, int(length[0]))
 _, err := io.ReadFull(c, data)
 return string(data), err
}

func (tm *TunnelManager) handleSOCKS(client net.Conn) {
 defer client.Close()
 client.SetDeadline(time.Now().Add(15*time.Second))
 var hello [2]byte
 if _, err := io.ReadFull(client, hello[:]); err != nil || hello[0] != 5 { return }
 methods := make([]byte, int(hello[1]))
 if _, err := io.ReadFull(client, methods); err != nil { return }
 valid := false
 for _, method := range methods { if method == 2 { valid = true } }
 if !valid { client.Write([]byte{5,255}); return }
 client.Write([]byte{5,2})
 var version [1]byte
 if _, err := io.ReadFull(client, version[:]); err != nil || version[0] != 1 { return }
 username, err := readSized(client); if err != nil { return }
 password, err := readSized(client); if err != nil { return }
 var identity Identity
 if err := tm.api(context.Background(), "/api/internal/proxy-auth", map[string]string{"username":username,"password":password}, &identity); err != nil {
  client.Write([]byte{1,1}); return
 }
 device := tm.device(identity.NodeID)
 if device == nil { client.Write([]byte{1,1}); return }
 client.Write([]byte{1,0})
 var request [4]byte
 if _, err := io.ReadFull(client, request[:]); err != nil || request[0] != 5 || request[1] != 1 || request[2] != 0 { return }
 var host string
 switch request[3] {
 case 1:
  ip := make([]byte,4); if _, err := io.ReadFull(client,ip); err != nil { return }; host = net.IP(ip).String()
 case 4:
  ip := make([]byte,16); if _, err := io.ReadFull(client,ip); err != nil { return }; host = net.IP(ip).String()
 case 3:
  host, err = readSized(client); if err != nil { return }
 default: return
 }
 var port [2]byte
 if _, err := io.ReadFull(client,port[:]); err != nil { return }
 targetPort := binary.BigEndian.Uint16(port[:]); if targetPort == 0 { return }
 if ip := net.ParseIP(host); ip != nil && !PublicIP(ip) && !tm.allowPrivate { return }
 stream, err := tm.openStream(device, identity, net.JoinHostPort(host,strconv.Itoa(int(targetPort))))
 if err != nil { client.Write([]byte{5,4,0,1,0,0,0,0,0,0}); return }
 defer stream.close()
 client.Write([]byte{5,0,0,1,0,0,0,0,0,0})
 client.SetDeadline(time.Time{})
 done := make(chan struct{})
 go func() {
  defer close(done)
  buffer := make([]byte, 32*1024)
  for {
   client.SetReadDeadline(time.Now().Add(2*time.Minute))
   n, err := client.Read(buffer)
   if n > 0 {
    if tm.charge(stream, n, 0) != nil || device.binary(stream.id, buffer[:n]) != nil { break }
   }
   if err != nil { break }
  }
  stream.close(); client.Close()
 }()
 for {
  select {
  case data := <-stream.data:
   if tm.charge(stream, 0, len(data)) != nil { return }
   client.SetWriteDeadline(time.Now().Add(15*time.Second))
   if _, err := client.Write(data); err != nil { return }
  case <-stream.done: return
  case <-done: return
  }
 }
}
