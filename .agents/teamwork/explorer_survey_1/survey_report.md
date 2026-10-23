# Relatório de Levantamento e Auditoria Técnica — Infraestrutura Raiz & Broker

**Data:** 2026-10-20  
**Auditor:** Explorer Survey 1 (Arquitetura, Infraestrutura & Broker Go)  
**Escopo:**
1. Arquivos de infraestrutura na raiz (`docker-compose.yml`, `docker-compose.test.yml`, Dockerfiles, `.env*`, `.syncpackrc`, scripts)
2. Diretório `broker/` (Golang 1.23: `cmd/broker`, `internal/config`, `internal/redis`, `internal/tunnel`, `Dockerfile`, `.air.toml`)

---

## 1. Mapeamento Geral do Subsistema

### 1.1 Infraestrutura Raiz e Orquestração Docker
- **`docker-compose.yml`**:
  - Serviços orquestrados:
    - `postgres`: PostgreSQL 17 Alpine (banco principal, healthcheck `pg_isready`)
    - `redis`: Redis 7 Alpine (cache, tickets, ratelimit, pub/sub, healthcheck `redis-cli ping`)
    - `migrate`: Container efêmero de migração Prisma (`npx prisma migrate deploy`)
    - `web`: Next.js 15 Standalone Runner (porta exposta `${WEB_PORT:-3000}`)
    - `worker`: Background worker (`npm run worker`)
    - `broker`: Go Router/Tunnel/SOCKS5 (portas expostas `${SOCKS_PORT:-10000}` e `${BROKER_PORT:-10001}`)
- **`docker-compose.test.yml`**:
  - Serviços de teste: apenas `postgres` (porta 55432) e `redis` (porta 56379). Não orquestra instâncias de teste para `web` nem `broker`.
- **Arquivos de Ambiente**:
  - `.env`: Arquivo real contendo credenciais de desenvolvimento/teste.
  - `.env.example`: Modelo documentado com variáveis de exemplo.
  - `.env.local.example`: Modelo para execução local.
- **Configurações & Scripts**:
  - `.syncpackrc`: Configuração de sincronização de dependências npm referenciando `package.json` na raiz (inexistente).
  - `scripts/mobile-validation.cjs`: Script de teste para validação de políticas de destino de IPs/hostnames em apps mobile.

### 1.2 Arquitetura do Broker (`broker/`)
- **Linguagem & Versão**: Go 1.23.0 (`go.mod`, `go.sum`).
- **Dependências Principais**:
  - `github.com/gorilla/websocket` (v1.5.3) — Túneis WebSocket e stream de dashboard.
  - `github.com/redis/go-redis/v9` (v9.6.1) — Cliente Redis.
  - `github.com/joho/godotenv` (v1.5.1) — Carregador de variáveis de ambiente.
  - `golang.org/x/crypto` (v0.31.0) — Criptografia e bcrypt.
- **Portas & Endpoints**:
  - Porta `10000` (TCP): Servidor SOCKS5 (RFC 1928 / RFC 1929).
  - Porta `10001` (HTTP/WS):
    - `GET /health` (Healthcheck via Redis Ping).
    - `GET /tunnel` (WebSocket reverso com dispositivos nós — Android / HiveDocker).
    - `GET /dashboard-stream` (WebSocket para streaming de telemetria e eventos ao frontend).
    - `POST /internal/revoke` (Webhook interno para expurgar conexões de proxies/nós revogados).
    - `POST /internal/rename-node` (Webhook interno para propagar renomeação de nó).

---

## 2. Catálogo Detalhado de Defeitos e Vulnerabilidades

### Categoria A: Infraestrutura, Docker & Configuração

#### [INFRA-01] [CRÍTICO] Variáveis Obrigatórias Ausentes no `.env` Causam Falha Imediata no `docker compose up`
- **Arquivo**: `c:\Users\theja\HiveNode\docker-compose.yml` (linhas 8, 18, 33, 34, 35) e `c:\Users\theja\HiveNode\.env`
- **Causa Raiz**:
  O `docker-compose.yml` define variáveis mandatórias com sintaxe de parada (`:?`):
  - Linha 8: `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}`
  - Linha 18: `--requirepass, "${REDIS_PASSWORD:?Set REDIS_PASSWORD}"`
  - Linha 33: `JWT_SECRET: ${JWT_SECRET:?Set JWT_SECRET}`
  - Linha 34: `ENCRYPTION_KEY: ${ENCRYPTION_KEY:?Set ENCRYPTION_KEY}`
  - Linha 35: `BROKER_INTERNAL_SECRET: ${BROKER_INTERNAL_SECRET:?Set BROKER_INTERNAL_SECRET}`
  No entanto, o arquivo `.env` da raiz não define `POSTGRES_PASSWORD`, `REDIS_PASSWORD` nem `BROKER_INTERNAL_SECRET`. Ele define apenas `DATABASE_URL` e `REDIS_URL`.
- **Evidência**:
  Ao executar `docker compose up`, o Docker Compose aborta com erro:
  `variable POSTGRES_PASSWORD: Set POSTGRES_PASSWORD`.
- **Impacto**: O ambiente containerizado padrão do projeto não inicializa a partir do `.env` fornecido.

---

#### [INFRA-02] [ALTO] Nomes de Variáveis de Porta Divergentes entre `.env` e `docker-compose.yml`
- **Arquivo**: `c:\Users\theja\HiveNode\docker-compose.yml` (linhas 75-77) vs `c:\Users\theja\HiveNode\.env` (linhas 49-50) e `c:\Users\theja\HiveNode\.env.example` (linhas 45-46)
- **Causa Raiz**:
  No `docker-compose.yml`:
  ```yaml
  ports:
    - "${SOCKS_BIND:-127.0.0.1}:${SOCKS_PORT:-10000}:10000"
    - "${BROKER_BIND:-127.0.0.1}:${BROKER_PORT:-10001}:10001"
  ```
  No `.env` e `.env.example`:
  ```ini
  BROKER_SOCKS5_PORT=10000
  BROKER_TUNNEL_PORT=10001
  ```
- **Evidência**: O `docker-compose.yml` referencia `SOCKS_PORT` e `BROKER_PORT`, enquanto os arquivos `.env` utilizam `BROKER_SOCKS5_PORT` e `BROKER_TUNNEL_PORT`.
- **Impacto**: Qualquer customização de portas feita pelo operador no `.env` é silenciosamente ignorada pelo compose, que sempre utiliza os fallbacks padrão.

---

#### [INFRA-03] [ALTO] Atraso Excessivo de Inicialização do Broker por Dependência de Healthcheck
- **Arquivo**: `c:\Users\theja\HiveNode\docker-compose.yml` (linhas 78-81) e `c:\Users\theja\HiveNode\web\Dockerfile` (linha 27)
- **Causa Raiz**:
  O serviço `broker` possui:
  ```yaml
  depends_on:
    web: { condition: service_healthy }
    redis: { condition: service_healthy }
  ```
  No `web/Dockerfile`, a diretiva de healthcheck possui:
  `HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://localhost:3000/api/health')..."`
  O container `web` não é considerado saudável até que passem pelo menos 30 a 60 segundos do start-period + primeiro intervalo bem-sucedido.
- **Evidência**: Durante a inicialização completa, o `broker` fica bloqueado e indisponível por até 1 minuto, impedindo conexões SOCKS5 e registro de nós mesmo após o Redis e o banco já estarem prontos.
- **Impacto**: Indisponibilidade prolongada e risco de timeout em orquestradores (Coolify/Docker Swarm/K8s).

---

#### [INFRA-04] [MÉDIO] Erros de Sintaxe, Typo e Caracteres Não-ASCII no `.env` e `.env.example`
- **Arquivo**: `c:\Users\theja\HiveNode\.env` (linhas 34-37) e `c:\Users\theja\HiveNode\.env.example` (linhas 30-33)
- **Causa Raiz**:
  - Linha 34: `ABACATe_PAY_MODE="dev"` (letra minúscula inadvertida).
  - Linha 35: `ABACATE_PAY_API_VERÇÂO="v2"` (chave de variável de ambiente com caracteres especiais Ç e Â).
  - Linha 37: `ABACATE_PAY_DOCUMENTAÇÃO=h"ttps://www.abacatepay.com/llms.txt"` (aspas invertidas `h"ttps://...` e caracteres especiais Ç e Ã).
- **Evidência**: Parsers de ambiente padrão POSIX (`dotenv`, shells Linux) falham ao interpretar variáveis com caracteres Unicode ou geram valores truncados (`h"ttps://...`).
- **Impacto**: Falha no parsing de configuração em ambientes Linux/Docker.

---

#### [INFRA-05] [MÉDIO] Arquivo `package.json` Inexistente Referenciado em `.syncpackrc`
- **Arquivo**: `c:\Users\theja\HiveNode\.syncpackrc` (linha 3)
- **Causa Raiz**:
  `.syncpackrc` lista `"package.json"` como primeiro item da lista `"source"`. Não existe `package.json` na raiz de `c:\Users\theja\HiveNode`.
- **Evidência**: `list_dir` na raiz confirma a ausência de `package.json`.
- **Impacto**: Falha na execução da ferramenta `syncpack` durante validações de monorepo.

---

#### [INFRA-06] [MÉDIO] Arquitetura Hardcoded para `GOARCH=amd64` no `broker/Dockerfile`
- **Arquivo**: `c:\Users\theja\HiveNode\broker\Dockerfile` (linha 34)
- **Causa Raiz**:
  `RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /broker ./cmd/broker/main.go`
- **Evidência**: O `GOARCH=amd64` está fixado diretamente no comando de build.
- **Impacto**: Builds do container `broker` falham ou geram binários que rodam com emulação QEMU lenta em hosts ARM64 (Apple Silicon, instâncias Graviton na AWS, servidores ARM).

---

#### [INFRA-07] [BAIXO] Excesso de Binários Compilados (.exe e ELF) Rastreados no Diretório `broker/`
- **Arquivo**: `broker/broker.exe` (11 MB), `broker/main.exe` (10.9 MB), `broker/bin/broker` (10.7 MB), `broker/cmd/broker/broker.exe` (10.9 MB), `broker/tmp/main` (11.1 MB), `broker/tmp/build-errors.log`
- **Causa Raiz**:
  Ausência de `.gitignore` no diretório `broker/` e falta de regras para `broker/bin/`, `broker/tmp/` e `*.exe` no `.gitignore` raiz.
- **Evidência**: Mais de 54 MB de binários compilados residem na árvore do projeto e o arquivo `broker/tmp/build-errors.log` contém `exit status 1exit status 1exit status 1`.
- **Impacto**: Inchaço desnecessário do repositório Git e risco de execução de binários defasados.

---

### Categoria B: Broker — Concorrência, Vazamentos, Segurança e Lógica

#### [BROKER-01] [CRÍTICO] Gargalo Extremo de Desempenho e Condição de Corrida: Faturamento HTTP Síncrono a Cada Chunk de 32KB
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\tunnel\socks5.go` (linhas 96, 105), `c:\Users\theja\HiveNode\broker\internal\tunnel\websocket.go` (linhas 189-199) e `c:\Users\theja\HiveNode\web\src\app\api\internal\usage\route.ts` (linhas 12-31)
- **Causa Raiz**:
  No loop de leitura/escrita do SOCKS5 em `socks5.go`:
  ```go
  n, err := client.Read(buffer)
  if n > 0 {
      if tm.charge(stream, n, 0) != nil || device.binary(stream.id, buffer[:n]) != nil { break }
  }
  ...
  case data := <-stream.data:
      if tm.charge(stream, 0, len(data)) != nil { return }
      if _, err := client.Write(data); err != nil { return }
  ```
  `tm.charge` invoca `tm.api(context.Background(), "/api/internal/usage", event, nil)` síncronamente via HTTP POST a cada bloco de até 32KB!
  No backend `web`, `POST /api/internal/usage` executa uma **transação serializável** no Postgres (`await serializable(async tx => ...)`), realizando múltiplas queries, atualizando balanço e criando registros de auditoria.
- **Evidência**:
  1. Para transferir 100 MB, o broker dispara mais de 3.125 requisições HTTP síncronas contra o Next.js e 3.125 transações serializáveis no PostgreSQL.
  2. Múltiplos pacotes concorrentes para o mesmo proxy/usuário geram falhas de serialização no banco (`P2034`).
  3. Ao encontrar qualquer erro ou timeout em `tm.charge`, o broker encerra a conexão (`break` / `return`), abortando a sessão do usuário.
  4. Viola frontalmente o design documentado em `broker/README.md` ("Contar os bytes trafegados em memória e repassar o consumo para o Redis") e ignora as variáveis `BillingFlushMB: 5` e `BillingFlushSecs: 30` definidas em `config.go`.
- **Impacto**: Queda drástica de throughput (de dezenas de MB/s para dezenas de KB/s), sobrecarga massiva no Next.js/Postgres e encerramento prematuro de conexões ativas.

---

#### [BROKER-02] [CRÍTICO] Descarte Prematuro de Streams sob Tráfego Normal (`default: s.close()`)
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\tunnel\websocket.go` (linhas 294-299)
- **Causa Raiz**:
  Em `HandleWS`, ao receber mensagens binárias vindas do nó:
  ```go
  select {
  case s.data <- payload:
  case <-s.done:
  default:
      s.close()
  }
  ```
  O buffer do canal `s.data` é de apenas 32 elementos (`make(chan []byte, 32)` = ~1 MB).
  Como o consumidor em `socks5.go` é retardado pelas chamadas HTTP síncronas de cobrança (`tm.charge`), o buffer enche rapidamente quando o nó transmite em velocidade de rede.
  Quando o canal enche, a instrução `select` salta imediatamente para o `default:` e **fecha a stream** (`s.close()`).
- **Evidência**: Não há aplicação de contrapressão (backpressure) ou pausa na leitura do WebSocket; qualquer pico de dados que preencha 32 chunks derruba a conexão TCP do usuário.
- **Impacto**: Queda recorrente de conexões SOCKS5 durante downloads ou transferências de arquivos maiores que 1 MB.

---

#### [BROKER-03] [ALTO] Bypass de Proteção SSRF e Filtro de IPs Privados via Hostnames / Nomes de Domínio
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\tunnel\socks5.go` (linha 82)
- **Causa Raiz**:
  Em `socks5.go`:
  ```go
  if ip := net.ParseIP(host); ip != nil && !PublicIP(ip) && !tm.allowPrivate { return }
  ```
  Se o cliente SOCKS5 conectar solicitando um IP literal (ex: `127.0.0.1`), `net.ParseIP` retorna a estrutura IP e valida `PublicIP(ip)`.
  Porém, se o cliente solicitar um hostname (ex: `localhost`, `router.local`, `metadata.google.internal` ou domínio resolving para 127.0.0.1 via DNS rebinding), `net.ParseIP(host)` retorna `nil`.
  A condição `ip != nil` é falsa, e a verificação de segurança é **totalmente ignorada**, repassando o comando `DIAL` com `localhost:<port>` diretamente para o nó de destino.
- **Evidência**: Linha 82 não realiza resolução prévia de DNS nem valida nomes reservados como `"localhost"` ou TLDs locais.
- **Impacto**: Usuários autenticados no SOCKS5 podem atingir serviços em loopback ou na rede local privada (LAN) dos nós nós conectados.

---

#### [BROKER-04] [MÉDIO] Violação do Protocolo SOCKS5 (RFC 1928 / RFC 1929) em Falhas de Autorização e Nós Offline
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\tunnel\socks5.go` (linhas 54, 65, 77, 81, 82)
- **Causa Raiz**:
  1. Linha 65: Quando a autenticação do usuário é bem-sucedida no backend, mas o nó alvo está offline (`device == nil`), o broker responde `client.Write([]byte{1, 1})` (código de credencial inválida da RFC 1929) e fecha o socket. O cliente recebe "erro de senha incorreta" em vez de handshake aprovado seguido de código de erro SOCKS5 `0x04` (Host unreachable) ou `0x05` (Connection refused).
  2. Linhas 77, 81, 82: Ao rejeitar endereço de tipo inválido, porta zero ou IP privado bloqueado, a função executa `return` simples sem enviar resposta de erro SOCKS5 (`0x02` - connection not allowed by ruleset). O socket é fechado abruptamente (FIN/RST), causando erro de "Unexpected EOF" no cliente.
- **Evidência**: Ausência de envio dos bytes padronizados de resposta de status de conexão SOCKS5 antes do encerramento.
- **Impacto**: Clientes SOCKS5 (browsers, cURL, proxies encadeados) tratam nós offline como falha de credencial e conexões bloqueadas como falhas de rede anômalas.

---

#### [BROKER-05] [MÉDIO] Bloqueio Head-of-Line Síncrono no `TunnelManager.Broadcast` para Clientes de Dashboard
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\tunnel\websocket.go` (linhas 341-356)
- **Causa Raiz**:
  O método `Broadcast` itera por todos os dashboards conectados e chama `c.device.json(event)` em sequência síncrona.
  Cada escrita possui timeout de 10 segundos (`d.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))`).
  Se um cliente estiver em rede lenta ou com buffer de socket congestionado, a chamada bloqueia por até 10 segundos.
  Como `Broadcast` é disparado síncronamente a partir de eventos de `HandleWS` (telemetria, conexão, desconexão de nós), todos os túneis de nós ficam retidos esperando o broadcast terminar.
- **Evidência**:
  Não há filas de mensagens assíncronas por cliente nem política de descarte rápido para clientes de dashboard lentos.
- **Impacto**: Degradação geral da responsividade do broker quando múltiplos navegadores mantêm abas de dashboard abertas.

---

#### [BROKER-06] [MÉDIO] Desconexão Inevitável dos WebSockets de Dashboard a Cada 10 Minutos e Validação Rígida de Origin
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\tunnel\websocket.go` (linhas 380-381, 392-397)
- **Causa Raiz**:
  1. Linha 392: `ws.SetReadDeadline(time.Now().Add(10 * time.Minute))` é configurado apenas uma vez na abertura da conexão. Não há `PongHandler` nem renovação de deadline na leitura de mensagens de controle. Assim, exatamente após 10 minutos, o WebSocket do dashboard encerra com erro de timeout de I/O.
  2. Linhas 380-381:
     `origin := os.Getenv("WEB_ORIGIN")`
     `upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return origin != "" && r.Header.Get("Origin") == origin }}`
     A checagem exige igualdade exata de strings. Se `WEB_ORIGIN` possuir barra final (ex: `https://dominio.com/`), enquanto o browser envia `https://dominio.com`, a validação falha e recusa com HTTP 403. Se `WEB_ORIGIN` estiver vazio, todas as conexões são recusadas.
- **Evidência**: Código em `HandleDashboard` não possui `SetPongHandler` (ao contrário de `HandleWS` na linha 249) e faz comparação direta `==`.
- **Impacto**: Quedas contínuas da conexão do painel administrativo e risco de recusa total se a URL base contiver formatação ligeiramente distinta.

---

#### [BROKER-07] [MÉDIO] Ausência de Encerramento Gracioso (Graceful Shutdown)
- **Arquivo**: `c:\Users\theja\HiveNode\broker\cmd\broker\main.go` (linhas 36-38)
- **Causa Raiz**:
  `main.go` inicia o servidor HTTP em uma goroutine (`go func(){ ... }()`) e bloqueia na thread principal com `tunnel.StartSocks5Server(...)`. Não há escuta de sinais de interrupção (`SIGINT`, `SIGTERM` via `os/signal`).
- **Evidência**: Quando o Docker envia `SIGTERM` para parar o container, a runtime Go encerra abruptamente o processo.
- **Impacto**:
  1. Conexões TCP ativas e túneis WebSocket são cortados a frio sem enviar pacotes de finalização.
  2. As chaves Redis `node:online:<nodeId>` permanecem válidas pelo TTL remanescente (até 75 segundos), exibindo nós como "online" falsamente após o encerramento do broker.

---

#### [BROKER-08] [MÉDIO] Bloqueio Unificado por Dispositivo em Transferências Concorrentes
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\tunnel\websocket.go` (linhas 38, 43-48, 56-62)
- **Causa Raiz**:
  A estrutura `Device` possui um único WebSocket (`ws`) e um único `mu sync.Mutex`.
  Cada envio de dados binários de qualquer stream (até 64 streams simultâneas por dispositivo) disputa esse mesmo mutex e define um write deadline de 10s:
  `d.mu.Lock(); d.ws.SetWriteDeadline(...); d.ws.WriteMessage(...)`.
- **Evidência**: Uma stream com tráfego intenso ou nó com uplink lento bloqueia a escrita de todas as outras 63 streams associadas àquele dispositivo.
- **Impacto**: Contenção de I/O e alta variabilidade de latência entre streams que compartilham o mesmo nó.

---

#### [BROKER-09] [BAIXO] Código Morto e Risco de Confusão em `broker/internal/redis/client.go`
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\redis\client.go` (linhas 39-80) e `broker/internal/tunnel/socks5.go` (linha 17)
- **Causa Raiz**:
  O método `ValidateSOCKS5User` em `client.go` implementa autenticação lendo a chave `proxy:<username>` no Redis com verificação de hash bcrypt.
  No entanto, esse método não é chamado em nenhum lugar do sistema! Em `socks5.go:17`, o parâmetro `_ *redis.Client` é ignorado, e a validação é feita via requisição HTTP para a API web (`/api/internal/proxy-auth`). Além disso, o sistema `web` não popula `proxy:<username>` no Redis durante a criação de credenciais.
- **Evidência**: Busca por `ValidateSOCKS5User` em todo o repositório confirma que ele só é referenciado em seu próprio teste unitário (`client_test.go`).
- **Impacto**: Código morto que induz ao erro sobre a rota real de autenticação e manutenção desnecessária de testes que não refletem a arquitetura de produção.

---

#### [BROKER-10] [BAIXO] `panic` em Caso de Falha de Entropia em `uuid()`
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\tunnel\websocket.go` (linhas 142-151)
- **Causa Raiz**:
  ```go
  func uuid() string {
      b := make([]byte, 16)
      if _, err := rand.Read(b); err != nil {
          panic(err)
      }
      ...
  }
  ```
- **Evidência**: `uuid()` dispara `panic` direto se `crypto/rand.Read` falhar. Sem `recover()` no pipeline de cobrança ou criação de streams, o processo do broker é derrubado.
- **Impacto**: Falha catastrófica não tratada em caso de exaustão temporária de entropia do sistema operacional.

---

#### [BROKER-11] [BAIXO] Caminho Relativo em `config.go` Quebra Fora de Diretório Específico
- **Arquivo**: `c:\Users\theja\HiveNode\broker\internal\config\config.go` (linha 22)
- **Causa Raiz**:
  `godotenv.Load("../../.env")`
  Se o broker for executado a partir da pasta raiz do projeto ou dentro do container Docker (`WORKDIR /app`), o caminho relativo `../../.env` busca fora da árvore do projeto ou na raiz do filesystem.
- **Evidência**: Linha 22 assume que o executável está rodando com CWD dentro de `cmd/broker/`.
- **Impacto**: Falha no carregamento de `.env` em testes ou execuções manuais a partir da raiz de `broker/`.

---

## 3. Matriz Consolidada de Riscos e Impacto

| ID | Componente | Severidade | Descrição Resumida |
|---|---|---|---|
| **INFRA-01** | `docker-compose.yml` / `.env` | **Crítico** | Variáveis obrigatórias ausentes (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, etc.) quebrando `docker compose up`. |
| **INFRA-02** | `docker-compose.yml` / `.env` | **Alto** | Nomes de variáveis de porta divergentes entre `.env` e compose (`SOCKS_PORT` vs `BROKER_SOCKS5_PORT`). |
| **INFRA-03** | `docker-compose.yml` / `web/Dockerfile` | **Alto** | Atraso prolongado (30-60s) de inicialização do Broker devido a start-period longo no healthcheck do `web`. |
| **INFRA-04** | `.env` / `.env.example` | **Médio** | Typo de sintaxe (`h"ttps://...`) e chaves com caracteres acentuados não-ASCII (Ç, Â, Ã). |
| **INFRA-05** | `.syncpackrc` | **Médio** | Referência a `package.json` raiz inexistente quebrando ferramentas de syncpack. |
| **INFRA-06** | `broker/Dockerfile` | **Médio** | `GOARCH=amd64` hardcoded quebrando builds nativos em arquiteturas ARM64 (Apple Silicon, Graviton). |
| **INFRA-07** | `broker/` / `.gitignore` | **Baixo** | Mais de 54 MB de executáveis Go (.exe / ELF) e logs de build rastreados no repositório. |
| **BROKER-01** | `broker/socks5.go` & `web` API | **Crítico** | Faturamento síncrono via HTTP a cada 32KB com transações serializáveis no Postgres gerando gargalo extremo e quedas. |
| **BROKER-02** | `broker/websocket.go` | **Crítico** | Queda forçada de conexões (`default: s.close()`) quando buffer de dados de 32 chunks enche em transferências >1MB. |
| **BROKER-03** | `broker/socks5.go` | **Alto** | Vulnerabilidade de bypass de SSRF permitindo acesso a `localhost` e hosts privados via hostname/domínio. |
| **BROKER-04** | `broker/socks5.go` | **Médio** | Violação da RFC 1928/1929: nó offline retorna erro de senha incorreta e destinos bloqueados fecham socket sem resposta. |
| **BROKER-05** | `broker/websocket.go` | **Médio** | Bloqueio head-of-line síncrono no `Broadcast` de eventos do dashboard retendo os loops de túneis de nós. |
| **BROKER-06** | `broker/websocket.go` | **Médio** | Queda obrigatória de WebSockets de dashboard após 10 min por falta de PongHandler e checagem estrita de Origin. |
| **BROKER-07** | `broker/main.go` | **Médio** | Ausência de captura de `SIGINT`/`SIGTERM` para encerramento gracioso, mantendo nós online no Redis por até 75s. |
| **BROKER-08** | `broker/websocket.go` | **Médio** | Mutex único por dispositivo bloqueando todas as 64 streams ativas durante qualquer escrita de socket lenta. |
| **BROKER-09** | `broker/redis/client.go` | **Baixo** | Código morto em `ValidateSOCKS5User` e parâmetro de Redis descartado em `StartSocks5Server`. |
| **BROKER-10** | `broker/websocket.go` | **Baixo** | Invocação direta de `panic(err)` em falhas de entropia de `crypto/rand` em `uuid()`. |
| **BROKER-11** | `broker/config.go` | **Baixo** | Caminho relativo fixo `../../.env` quebrando leitura caso o binário não seja executado de `cmd/broker/`. |

---
*Relatório gerado em conformidade estrita com o modo de averiguação (Read-Only).*
