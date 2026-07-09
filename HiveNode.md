# Documento de Arquitetura e Regras de Negócio: Provedor de Proxy IaaS (Mobile/Residencial)

## 1. Visão Geral do Sistema
Plataforma SaaS/IaaS que transforma dispositivos móveis (Android, TV Boxes, Mini PCs, etc.) e futuros servidores em nós de proxy SOCKS5h. O sistema permite a gestão de tráfego, roteamento dinâmico e cobrança automatizada.
O diferencial central é a divisão entre o modelo **BYOD (Traga Seu Próprio Aparelho)** e o modelo **Premium (Rede Própria da Plataforma)**, com resolução de DNS (SOCKS5h) executada diretamente na ponta (dispositivo final) para garantir máximo anonimato.

---

## 2. Stack Tecnológica
A arquitetura é baseada em microsserviços divididos por responsabilidade de hardware e rede:

### A. Front-end & Painel de Gestão
*   **Framework:** Next.js (App Router) + Node.js.
*   **UI/UX:** Tailwind CSS + Shadcn UI.
*   **Responsabilidade:** Autenticação de clientes, dashboard de consumo (GB), gestão de frotas (Nodes), geração de credenciais de proxy, relatórios financeiros.

### B. Back-end API & Banco de Dados (O Cérebro)
*   **Banco de Dados Relacional:** PostgreSQL.
*   **ORM:** Prisma.
*   **Banco de Dados em Memória:** Redis (Essencial para comunicação em tempo real com o roteador).
*   **Filas/Workers:** BullMQ (Disparo de webhooks, suspensão de contas inadimplentes).
*   **Gateway de Pagamento:** Abacate Pay API v2 (Assinaturas e Top-ups).

### C. Broker Central / Proxy Server (O Motor de Rede)
*   **Linguagem:** Go (Golang).
*   **Protocolos:** SOCKS5 (Entrada TCP) e WebSockets/gRPC (Túnel Reverso com os nós).
*   **Responsabilidade:** Receber conexões SOCKS5, autenticar no Redis em milissegundos, empurrar o tráfego TCP pelo túnel do Android correspondente, contar bytes trafegados (Toll Booth) e derrubar conexões sem saldo.

### D. Aplicativo Cliente (O Worker / Nó)
*   **Plataforma:** Android Nativo (Kotlin) ou Flutter.
*   **Motor de Túnel:** Binário Go embutido (via `gomobile` ou cliente modificado do Chisel/FRP).
*   **Permissões Críticas:** Foreground Service, WakeLock, Ignorar Otimização de Bateria.
*   **Responsabilidade:** Receber tráfego do Broker, resolver DNS localmente via 4G/Wi-Fi e retransmitir para a internet.

---

## 3. Regras de Negócio e Monetização

### Modalidade A: BYOD (Bring Your Own Device)
*   **Como funciona:** O cliente final instala o App Android nos próprios aparelhos. O sistema fornece o túnel de roteamento.
*   **Cobrança:** Assinatura Recorrente Fixa (Ex: R$ 49,90/mês por lote de 5 aparelhos).
*   **Consumo (GB):** Ilimitado (o cliente está gastando a própria internet móvel).
*   **Autenticação no App:** O cliente faz login com seu próprio e-mail e senha da plataforma. O aparelho entra no "Pool Privado" dele.

### Modalidade B: Rede Premium (Proxies Fornecidos pela Plataforma)
*   **Como funciona:** O cliente usa as credenciais SOCKS5 para usar a infraestrutura dos donos da plataforma (Master Nodes) ou futuros IPs Datacenter.
*   **Cobrança:** Assinatura Base + Consumo (Pay-as-you-go). Ex: R$ 99,00 base com 10GB inclusos.
*   **Consumo (GB):** Medido rigorosamente via Broker. Quando atinge o limite, a API do Abacate Pay realiza uma cobrança de "Top-up" automático (ex: R$ 50 por +5GB) ou o SOCKS5 é bloqueado até recarga via PIX.
*   **Autenticação no App (Nós Mestre):** O dono do sistema usa um Login Master. O aparelho entra no "Pool Público/Premium" para ser usado pelo algoritmo de Load Balancing.

---

## 4. Modelagem de Dados Inicial (Prisma Schema)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id               String       @id @default(uuid())
  email            String       @unique
  passwordHash     String
  role             Role         @default(CUSTOMER) // CUSTOMER ou ADMIN
  balanceGB        Float        @default(0.0) // Saldo para planos premium
  abacatePayCustId String?      // ID do cliente no gateway
  nodes            Node[]       // Aparelhos vinculados a este usuário (BYOD)
  subscriptions    Subscription[]
  createdAt        DateTime     @default(now())
}

model Node {
  id           String     @id @default(uuid())
  userId       String?    // Se nulo, é um nó público/Master
  user         User?      @relation(fields: [userId], references: [id])
  type         NodeType   // BYOD, MASTER_MOBILE, DATACENTER
  status       NodeStatus @default(OFFLINE)
  deviceModel  String?
  ipAddress    String?    // Último IP público conhecido do aparelho
  proxyUser    String     @unique // Usuário SOCKS5 gerado
  proxyPass    String     // Senha SOCKS5 gerada
  totalBytesRx BigInt     @default(0) // Download acumulado
  totalBytesTx BigInt     @default(0) // Upload acumulado
  createdAt    DateTime   @default(now())
}

model Subscription {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id])
  planType       PlanType  // BYOD_MONTHLY, PREMIUM_METERED
  status         SubStatus @default(ACTIVE)
  abacatePaySubId String
  currentPeriodEnd DateTime
}

enum Role { CUSTOMER, ADMIN }
enum NodeType { BYOD, MASTER_MOBILE, DATACENTER }
enum NodeStatus { ONLINE, OFFLINE, BLOCKED }
enum PlanType { BYOD_MONTHLY, PREMIUM_METERED }
enum SubStatus { ACTIVE, PAST_DUE, CANCELED }

```

## 5. Fluxos Principais de Rede (Data Journey)

### A. Inicialização do Nó (Android App)

1. App Android liga e o usuário faz login via API (Next.js).
2. API retorna um Token JWT e os dados do Broker (IP/Porta do servidor Go).
3. App abre um túnel WebSocket/gRPC com o servidor Go.
4. Servidor Go atualiza o banco (PostgreSQL + Redis) marcando o Node como `ONLINE`.

### B. Roteamento SOCKS5h (Evolution GO -> Broker -> Android)

1. Evolution conecta no Broker: `socks5://proxyUser:proxyPass@broker.alfastage.com.br:10000`.
2. O servidor Go extrai `proxyUser` e `proxyPass` e consulta o **Redis**:
* Acesso válido? (Verifica hash).
* A qual Node ID esse usuário pertence? (Retorna ID do WebSoket).
* Tem saldo de GB ou é plano BYOD?


3. Se falhar, Go fecha conexão. Se passar, Go aceita a conexão TCP.
4. Evolution envia o destino: `web.whatsapp.com:443`.
5. Broker envelopa esse destino e envia pelo túnel do Node ID.
6. Android App recebe o pedido, faz o DNS resolve para `web.whatsapp.com`, abre conexão TCP real com o WhatsApp e retransmite os pacotes de volta.

### C. Pedágio de Tráfego (Toll Booth Accounting)

1. Durante o fluxo de dados, o Broker (Go) mantém um contador em memória (RAM) dos bytes trafegados.
2. A cada X MBs (ex: 5MB) ou ao fechamento da conexão SOCKS5, o Go envia um evento assíncrono para o Redis: `DECRBY user:balance:ID 5242880`.
3. Se o `user:balance` atingir 0, o Redis dispara um evento Pub/Sub.
4. O Broker Go assina esse evento e, ao receber a notificação, encerra (Kill) imediatamente todas as conexões ativas TCP vinculadas àquele usuário.
5. Um Worker Node.js (BullMQ) consolida os bytes do Redis no PostgreSQL de tempos em tempos.

---

## 6. Integração Abacate Pay API v2

* **Webhook Listener (Next.js):** Endpoint configurado para escutar `invoice.paid`, `subscription.created` e `subscription.canceled`.
* **Top-Up Automático:** Worker monitora o saldo (`balanceGB`). Quando cai abaixo de 1GB no plano Premium, a API do Node.js aciona o Abacate Pay para emitir cobrança no cartão salvo do cliente e adicionar +10GB no PostgreSQL (e atualizar o Redis).
* **Bloqueio BYOD:** Se a assinatura mensal falhar, o status do Node no banco muda para `BLOCKED`. O Next.js apaga a chave do Redis, e o Broker corta o acesso instantaneamente.

---

## 7. Interfaces e Métodos Requeridos (Guia de Implementação)

### Node.js / Next.js API

* `POST /api/auth/login` -> (App/Web).
* `POST /api/nodes/register` -> Cria um aparelho no pool (BYOD ou Premium).
* `GET /api/nodes/my-nodes` -> Lista proxyUser, proxyPass e status dos aparelhos.
* `POST /api/webhooks/abacatepay` -> Processa pagamentos.

### Roteador Go (Broker)

* `func StartTCPServer(port int)` -> Escuta novas conexões SOCKS5.
* `func Authenticate(user, pass string) (nodeId, planType, error)` -> Consulta Redis.
* `func StartTunnelServer()` -> Escuta a chegada dos apps Android.
* `func Bridge(clientTCP, tunnelWS)` -> Liga a requisição SOCKS5 ao túnel e ativa o `CountBytes()`.
* `func SyncBilling()` -> Envia uso de banda ao Redis a cada X segundos.

### Android App

* `class TunnelService : Service()` -> Mantém WakeLock.
* `func startGoMobileClient(token, brokerHost)` -> Chama a lib Go nativa.
* `BroadcastReceiver` -> Reinicia o túnel no Boot do aparelho ou se a rede cair (Wi-Fi <-> 4G).