# Broker de Rede (Roteador Go)

Este diretório contém o microserviço desenvolvido em Go (Golang).

## Responsabilidades:
- Receber conexões SOCKS5 (Entrada TCP).
- Autenticar requisições no Redis de forma ultra-rápida.
- Gerenciar os túneis reversos via WebSockets/gRPC com os nós Android.
- Empurrar o tráfego TCP pelo túnel correspondente.
- Contar os bytes trafegados em memória e repassar o consumo para o Redis.
- Encerrar imediatamente conexões ativas caso o saldo acabe.

## Tecnologias:
- Go (Golang)
- Redis (Comunicação de cache e Pub/Sub)
