# Broker (Motor SOCKS5 em Go)

## Visão Geral
O Broker é a peça central que fica entre o cliente (navegador/curl) e o celular que fornecerá o IP de proxy. Ele atua fazendo o bypass de TCP.

## Estrutura de Diretórios e Fluxo
- `cmd/broker/main.go`: Ponto de entrada.
- `internal/redis/client.go`: Valida as senhas enviadas pelo cliente SOCKS5 baseando-se nos dados criados pela API Next.js.
- `internal/tunnel/websocket.go`: Sobe um servidor WS na porta 10001 e armazena os sockets de todos os celulares Android que se conectarem.
- `internal/tunnel/socks5.go`: Sobe a escuta de proxy na porta 10000. 

## Como a Ponte TCP <> WS funciona:
1. O usuário manda uma request `socks5://proxyUser:proxyPass@localhost:10000`.
2. O Redis aprova a credencial e descobre qual é o `nodeId`.
3. O `go-socks5` sobrepõe a função `Dial` (interceptando a internet real).
4. O `Dial` empacota os bits da conexão, decodifica em JSON Base64 e joga pelo WebSocket respectivo daquele Node Android.
