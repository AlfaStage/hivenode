package redis

import (
 "context"
 "fmt"
 "os"
 "testing"
 "time"
 "golang.org/x/crypto/bcrypt"
)
func TestValidateSOCKS5User(t *testing.T){
 url:=os.Getenv("TEST_REDIS_URL");if url==""{t.Skip("set TEST_REDIS_URL to an isolated test instance")}
 client,err:=NewClient(url);if err!=nil{t.Fatal(err)};defer client.Close()
 ctx:=context.Background();name:=fmt.Sprintf("test-%d",time.Now().UnixNano())
 defer client.Del(ctx,"proxy:"+name,"ratelimit:socks5:"+name)
 hash,_:=bcrypt.GenerateFromPassword([]byte("test-password"),bcrypt.MinCost)
 client.Set(ctx,"proxy:"+name,"node:"+string(hash)+":PRIVATE",time.Minute)
 if _,_,err=client.ValidateSOCKS5User(ctx,name,"wrong");err==nil{t.Fatal("accepted wrong password")}
 id,kind,err:=client.ValidateSOCKS5User(ctx,name,"test-password");if err!=nil||id!="node"||kind!="PRIVATE"{t.Fatalf("authentication: %s %s %v",id,kind,err)}
}
