package tunnel
import("net";"testing")
func TestPublicIP(t *testing.T){
 for _,address:=range []string{"127.0.0.1","10.1.2.3","192.168.1.1","169.254.169.254","100.64.0.1","::1","fd00::1","fe80::1","224.0.0.1","0.0.0.0"}{if PublicIP(net.ParseIP(address)){t.Errorf("accepted private target %s",address)}}
 for _,address:=range []string{"8.8.8.8","2606:4700:4700::1111"}{if !PublicIP(net.ParseIP(address)){t.Errorf("rejected public target %s",address)}}
}
