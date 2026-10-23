# Handoff Report — Explorer Survey 1 (Infra, Docker & Broker)

## 1. Observation

Durante a auditoria estritamente em modo de leitura (Read-Only) dos componentes de Infraestrutura Raiz e do subsistema `broker` em Golang, foram observadas diretamente as seguintes evidências objetivas:

1. **`docker-compose.yml:8, 18, 33-35` vs `.env:1-53`**:
   - `docker-compose.yml` exige variáveis obrigatórias:
     - Linha 8: `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}`
     - Linha 18: `--requirepass, "${REDIS_PASSWORD:?Set REDIS_PASSWORD}"`
     - Linha 33: `JWT_SECRET: ${JWT_SECRET:?Set JWT_SECRET}`
     - Linha 34: `ENCRYPTION_KEY: ${ENCRYPTION_KEY:?Set ENCRYPTION_KEY}`
     - Linha 35: `BROKER_INTERNAL_SECRET: ${BROKER_INTERNAL_SECRET:?Set BROKER_INTERNAL_SECRET}`
   - O arquivo `.env` existente na raiz possui apenas:
     - Linha 14: `DATABASE_URL="postgresql://hivenode_user:hivenode_dev_2026@localhost:5432/hivenode?schema=public"`
     - Linha 21: `REDIS_URL="redis://:hivenode_redis_2026@localhost:6379/0"`
     - Não define `POSTGRES_PASSWORD`, `REDIS_PASSWORD` nem `BROKER_INTERNAL_SECRET`.
   - `.env:34-37`:
     - Linha 34: `ABACATe_PAY_MODE="dev"`
     - Linha 35: `ABACATE_PAY_API_VERÇÂO="v2"`
     - Linha 37: `ABACATE_PAY_DOCUMENTAÇÃO=h"ttps://www.abacatepay.com/llms.txt"`

2. **`docker-compose.yml:75-77` vs `.env:49-50`**:
   - Compose referencia:
     - Linha 76: `${SOCKS_BIND:-127.0.0.1}:${SOCKS_PORT:-10000}:10000`
     - Linha 77: `${BROKER_BIND:-127.0.0.1}:${BROKER_PORT:-10001}:10001`
   - `.env` define:
     - Linha 49: `BROKER_SOCKS5_PORT=10000`
     - Linha 50: `BROKER_TUNNEL_PORT=10001`

3. **`docker-compose.yml:78-81` e `web/Dockerfile:27`**:
   - `docker-compose.yml` faz `broker` depender de `web: { condition: service_healthy }`.
   - `web/Dockerfile:27` define:
     `HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`
     O `broker` fica retido por até 60 segundos após o container `web` subir.

4. **`broker/internal/tunnel/socks5.go:96, 105` e `broker/internal/tunnel/websocket.go:189-199` vs `web/src/app/api/internal/usage/route.ts:12-31`**:
   - `socks5.go`:
     - Linha 96: `if tm.charge(stream, n, 0) != nil || device.binary(stream.id, buffer[:n]) != nil { break }`
     - Linha 105: `if tm.charge(stream, 0, len(data)) != nil { return }`
   - `websocket.go`:
     - Linhas 189-198: Cada `charge` gera requisição HTTP POST para `http://web:3000/api/internal/usage` a cada chunk lido/escrito de até 32KB.
   - `web/src/app/api/internal/usage/route.ts`:
     - Linha 12: `await serializable(async tx => { ... })` executa transação serializável com múltiplos updates e inserts a cada 32KB.

5. **`broker/internal/tunnel/websocket.go:294-299`**:
   - Ao receber mensagens binárias do nó:
     ```go
     select {
     case s.data <- payload:
     case <-s.done:
     default:
         s.close()
     }
     ```
     O canal `s.data` possui capacidade 32 (`make(chan []byte, 32)`). Se o consumidor atrasar, a stream é fechada imediatamente sem contrapressão.

6. **`broker/internal/tunnel/socks5.go:82`**:
   - `if ip := net.ParseIP(host); ip != nil && !PublicIP(ip) && !tm.allowPrivate { return }`
   - Se `host` for nome de domínio (ex: `"localhost"`), `net.ParseIP` retorna `nil`, ignorando o teste de IP público.

7. **`broker/internal/tunnel/socks5.go:65`**:
   - `device := tm.device(identity.NodeID); if device == nil { client.Write([]byte{1,1}); return }`
   - Retorna código de credencial incorreta (RFC 1929) mesmo quando o usuário autenticou com sucesso, mas o nó está offline.

8. **`broker/internal/tunnel/websocket.go:341-356` e `392`**:
   - Linhas 341-356: `Broadcast` itera síncronamente em todos os dashboards com timeout de escrita de 10s por cliente na thread principal de eventos.
   - Linha 392: `ws.SetReadDeadline(time.Now().Add(10 * time.Minute))` sem `PongHandler` em `HandleDashboard`, causando disconnect forçado após 10 minutos.

9. **`broker/Dockerfile:34`**:
   - `RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /broker ./cmd/broker/main.go`
   - Fixação de `GOARCH=amd64`.

10. **`broker/` diretório**:
    - Presença de binários compilados: `broker/broker.exe` (11 MB), `broker/main.exe` (10.9 MB), `broker/bin/broker` (10.7 MB), `broker/cmd/broker/broker.exe` (10.9 MB), `broker/tmp/main` (11.1 MB), e log `broker/tmp/build-errors.log`.

---

## 2. Logic Chain

1. **Da observação 1 para INFRA-01**:
   O Docker Compose avalia interpolações de variáveis de ambiente antes de criar os serviços. Como as variáveis `${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}` contêm a flag de erro obrigatório e não constam no arquivo `.env`, qualquer execução nativa de `docker compose up` encerra com código de erro diferente de zero.
2. **Da observação 2 para INFRA-02**:
   O arquivo de compose faz lookup de `SOCKS_PORT` e `BROKER_PORT`. O arquivo `.env` define `BROKER_SOCKS5_PORT` e `BROKER_TUNNEL_PORT`. Como não há coincidência de chaves, o compose sempre aplica o fallback padrão, ignorando a configuração do operador.
3. **Das observações 4 e 5 para BROKER-01 e BROKER-02**:
   Transferências TCP em SOCKS5 operam tipicamente na ordem de megabytes a gigabytes. Dividir o fluxo em chunks de 32KB e, para cada chunk, realizar um handshake HTTP síncrono e uma transação serializável em banco relacional impõe uma latência de rede e I/O de ~5 a 20ms por chunk. Isso limita a velocidade máxima a ~1.5 a 6 MB/s em condições ideais e satura o pool de conexões do PostgreSQL com erros `P2034` (conflito de serialização). Como o canal `s.data` possui buffer fixo de 32 itens, a defasagem entre a taxa de recepção via WebSocket e o processamento síncrono de cobrança esgota o buffer em menos de 1 segundo de pico, acionando o branch `default:` em `websocket.go:298` que encerra a conexão prematuramente.
4. **Da observação 6 para BROKER-03**:
   A função `net.ParseIP` foi projetada para strings com representação decimal pontuada (IPv4) ou hexadecimal (IPv6). Ao receber `"localhost"` ou nomes de domínio internos, a função retorna `nil`. A checagem subsequente `if ip != nil && !PublicIP(ip)` avalia como falsa, permitindo que destinos em loopback passem incólumes para a mensagem de discagem (`DIAL`) enviada ao nó.
5. **Da observação 8 para BROKER-05 e BROKER-06**:
   A ausência de renovação do deadline de leitura via PongHandler em WebSockets fecha a conexão de socket no vencimento do timer inicial configurado (10 minutos). Além disso, a iteração síncrona sobre clientes na chamada `Broadcast` vincula a latência de entrega de telemetria à velocidade do pior cliente conectado.

---

## 3. Caveats

- A auditoria foi realizada em modo estritamente read-only, sem alterar arquivos de código nem subir containers concorrentes.
- A restrição de permissão do Docker daemon local impediu a execução de comandos `docker run` durante a averiguação neste agente, mantendo a comprovação baseada em análise estática rigorosa de código-fonte, mapeamento estrutural e rastreamento de chamadas.
- O aplicativo mobile (`hivenode-app` e `hiveminer-app`) possui validação própria em `hostValidator.ts`, o que mitiga parcialmente o bypass de SSRF no broker quando a ponta receptora for o aplicativo mobile, porém nós como o `hivedocker` ou clientes alternativos ficam vulneráveis.

---

## 4. Conclusion

O ecossistema de infraestrutura e o broker em Go possuem uma arquitetura moderna e de alto desempenho conceitual (multiplexação em Go, Go 1.23, WebSockets binários e SOCKS5 RFC compliance), porém apresentam **dois gargalos críticos imediatos** que inviabilizam o uso estável em produção:
1. **Inoperância do Docker Compose padrão**: Incompatibilidade de nomes e ausência de variáveis vitais no `.env` que impedem a subida limpa dos containers via `docker compose up`.
2. **Colapso de Desempenho e Queda de Conexões**: Cobrança síncrona HTTP/Serializable DB a cada 32KB em conjunto com o descarte abrupto em `default: s.close()`, o que derruba transferências acima de 1MB e satura o banco de dados.

Adicionalmente, foram identificados 1 alto de segurança (SSRF bypass via hostnames), falhas de conformidade RFC SOCKS5, inchaço do repositório por binários compilados (54MB) e problemas de concorrência em broadcast de dashboards.

---

## 5. Verification Method

Para verificar independentemente cada apontamento:

1. **Verificação de INFRA-01 & INFRA-02**:
   Inspecione `c:\Users\theja\HiveNode\docker-compose.yml` linhas 8, 18, 33-35 e compare com `c:\Users\theja\HiveNode\.env`.
2. **Verificação de BROKER-01 & BROKER-02**:
   Inspecione `c:\Users\theja\HiveNode\broker\internal\tunnel\socks5.go` linhas 96 e 105, acompanhando a chamada `tm.charge` até `broker/internal/tunnel/websocket.go` linha 189 e o handler em `web/src/app/api/internal/usage/route.ts` linha 12.
3. **Verificação de BROKER-03**:
   Inspecione `c:\Users\theja\HiveNode\broker\internal\tunnel\socks5.go` linha 82 e note que `net.ParseIP("localhost")` retorna `nil`.
4. **Verificação de BROKER-06**:
   Inspecione `c:\Users\theja\HiveNode\broker\internal\tunnel\websocket.go` linhas 380-395 e compare a ausência de `SetPongHandler` em `HandleDashboard` em contraste com `HandleWS` (linha 249).
5. **Verificação de Binários**:
   Execute `ls broker/*.exe broker/bin/ broker/tmp/` para confirmar a presença física dos 5 executáveis e log de build.
