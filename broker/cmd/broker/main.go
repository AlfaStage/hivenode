package main

import (
 "crypto/subtle"
 "encoding/json"
 "log"
 "net/http"
 "os"
 "strings"
 "time"
 "github.com/hivenode/broker/internal/config"
 "github.com/hivenode/broker/internal/redis"
 "github.com/hivenode/broker/internal/tunnel"
)

func main(){
 cfg:=config.Load()
 client,err:=redis.NewClient(cfg.RedisURL);if err!=nil{log.Fatal(err)}
 tm:=tunnel.NewTunnelManager(client)
 mux:=http.NewServeMux()
 mux.HandleFunc("GET /health",func(w http.ResponseWriter,r *http.Request){if err:=client.Ping(r.Context()).Err();err!=nil{http.Error(w,"Redis unavailable",503);return};w.Write([]byte("OK"))})
 mux.HandleFunc("GET /tunnel",tm.HandleWS)
 mux.HandleFunc("GET /dashboard-stream",tm.HandleDashboard)
 internal:=func(next http.HandlerFunc)http.HandlerFunc{return func(w http.ResponseWriter,r *http.Request){
  secret:=os.Getenv("BROKER_INTERNAL_SECRET");token:=strings.TrimPrefix(r.Header.Get("Authorization"),"Bearer ")
  if len(secret)<32||subtle.ConstantTimeCompare([]byte(secret),[]byte(token))!=1{http.Error(w,"Forbidden",403);return};next(w,r)
 }}
 mux.HandleFunc("POST /internal/revoke",internal(func(w http.ResponseWriter,r *http.Request){
  var body struct{ProxyID string `json:"proxyId"`;NodeID string `json:"nodeId"`;UserID string `json:"userId"`}
  if json.NewDecoder(http.MaxBytesReader(w,r.Body,4096)).Decode(&body)!=nil{http.Error(w,"Invalid body",400);return};tm.Revoke(body.ProxyID,body.NodeID,body.UserID);w.WriteHeader(204)
 }))
 mux.HandleFunc("POST /internal/rename-node",internal(func(w http.ResponseWriter,r *http.Request){
  var body struct{NodeID string `json:"nodeId"`;NewName string `json:"newName"`}
  if json.NewDecoder(http.MaxBytesReader(w,r.Body,4096)).Decode(&body)!=nil||len(body.NewName)>100{http.Error(w,"Invalid body",400);return};tm.Rename(body.NodeID,body.NewName);w.WriteHeader(204)
 }))
 go func(){server:=&http.Server{Addr:":"+cfg.TunnelPort,Handler:mux,ReadHeaderTimeout:5*time.Second,IdleTimeout:60*time.Second};log.Fatal(server.ListenAndServe())}()
 tunnel.StartSocks5Server(cfg.Socks5Port,client,tm)
}
