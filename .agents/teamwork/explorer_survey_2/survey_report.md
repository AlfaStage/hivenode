# Relatório de Levantamento Técnico — Componente `web` (HiveNode)

**Data da Auditoria**: 2026-10-20  
**Auditor**: Explorer Survey 2 (Auditoria Técnica Especializada em Next.js, API, Prisma e Frontend)  
**Escopo**: Diretório `web/`, Banco de Dados / ORM Prisma, APIs REST, Autenticação/RBAC/IDOR, Componentes Frontend.  
**Modo de Execução**: Estritamente Leitura (Read-Only)  

---

## 1. Sumário Executivo

O componente `web` é uma aplicação Next.js (App Router, React 19, TypeScript 5, Tailwind CSS 4, Prisma ORM 7 com adapter `@prisma/adapter-pg`, Redis via `ioredis` e `bullmq`). Ele fornece a interface web do cliente (Painel, HiveMiner, Meus Proxies, Faturamento, SaaS B2B) e da administração (`/dashboard/admin/*`), além de expor rotas de API para os nós da rede, integração com o broker Go, e webhooks de pagamento (AbacatePay).

A auditoria identificou **21 defeitos e vulnerabilidades verificáveis** no componente `web`, distribuídos conforme abaixo:

| Severidade | Quantidade | Principais Áreas Afetadas |
|---|:---:|---|
| **Crítico** | 5 | Middleware Inoperante, Crash de Validação Zod, Crash de Ponteiro Nulo em Uso de Nós, Exposição de Chave HMAC, JWT Secret Inválido no `.env` |
| **Alto** | 5 | Enum inválido no Zod em assinaturas, Endpoint inexistente no backend para Sync AbacatePay, Teto de 1MB para telemetria de tráfego, Inicialização quebrada em `clean.js`, Importação quebrada em `local-integration.ts` |
| **Médio** | 7 | Códigos HTTP incorretos (500 em vez de 400/403), Rollover ingênuo de meses em assinaturas, Plano dummy "FREE" no banco, Inconsistência de planos de seed, Supressão silenciosa de falhas criptográficas |
| **Baixo** | 4 | Componentes órfãos sem importação, diretório vazio, migração sem instruções DDL, status code não tratado em erros de permissão |
| **Total** | **21** | |

---

## 2. Mapeamento Arquitetural do Módulo `web`

### 2.1 Estrutura de Diretórios e Arquivos

```
web/
├── Dockerfile                   # Multi-stage build (deps, builder, runner, tools)
├── next.config.ts               # Configuração standalone, serverExternalPackages
├── package.json                 # Manifest com Next 16.2.10, React 19, Prisma 7, Zod 4
├── tsconfig.json                # Bundler resolution, path alias @/* -> ./src/*
├── prisma.config.ts             # Configuração Prisma 7 (url via process.env.DATABASE_URL)
├── prisma/
│   ├── schema.prisma            # 13 modelos: User, Node, ProxyCredential, Subscription, Plan, etc.
│   ├── seed-plans.ts            # Seed de planos padrão (Starter, Pro, Enterprise, GB, etc.)
│   └── migrations/              # 2 migrações (20260909000000_initial, 20261013000000_create_schema)
├── scripts/                     # Scripts de teste e integração (local-integration, browser, cli)
├── worker/                      # Diretório órfão vazio
└── src/
    ├── proxy.ts                 # Tentativa de middleware (INOPERANTE por nomenclatura incorreta)
    ├── app/                     # Next.js App Router
    │   ├── layout.tsx           # Root Layout com Geist fonts e CookieBanner
    │   ├── page.tsx             # Redirecionamento inicial (/dashboard ou /login)
    │   ├── (auth)/              # Grupo de rotas públicas: login, register, forgot-password, reset-password
    │   ├── dashboard/           # Painel autenticado: overview, miner, proxies, billing
    │   │   └── admin/           # Painel administrativo: overview, users, nodes, proxies, plans, settings, etc.
    │   ├── saas/                # Gestão de compartilhamento B2B
    │   ├── cli.sh/route.ts      # Entrega do script de shell do cliente
    │   ├── install.sh/route.ts  # Entrega do instalador universal Linux
    │   └── api/                 # 39 rotas REST (admin, auth, billing, nodes, proxies, internal, webhooks)
    ├── components/              # Componentes de interface (Header, Sidebar, CookieBanner, UI Base-UI)
    ├── hooks/                   # use-admin-users.ts, use-dashboard-stream.ts
    └── lib/                     # Utilitários (auth, prisma, redis, broker, crypto, email, settings, etc.)
```

### 2.2 Modelagem de Dados (Prisma ORM)

Modelos principais e relacionamentos:
- **User**: Conta de usuário com papel (`Role`: `CUSTOMER` ou `ADMIN`), saldo (`balanceGB`), versão de sessão (`sessionVersion` para revogação instantânea de JWTs), `disabled`, Web3 (`walletAddress`, `hivePoints`, `referralCode`).
- **Node**: Aparelho Android ou servidor BYOD/Datacenter. Possui `userId` (opcional/SetNull), `type` (`NodeType`), `status` (`ONLINE`, `OFFLINE`, `BLOCKED`), `visibility` (`PRIVATE`, `PUBLIC`), `tunnelSecret` (chave simétrica encriptada para handshake WebSocket com o broker).
- **ProxyCredential**: Credencial SOCKS5 vinculada a um nó e um usuário. Guarda hash bcrypt (`proxyPass`), senha cifrada AES-256-GCM (`passwordEncrypted`), métricas de tráfego (`totalBytesRx`, `totalBytesTx`).
- **Subscription**: Assinatura recorrente vinculada a um `Plan` e ao gateway AbacatePay (`abacatePaySubId`).
- **Plan**: Catálogo de planos com categorias (`GENERAL`, `PRIVATE_FLEET`, `GLOBAL_FLEET`, `PAY_PER_USE`), limites de aparelhos, proxies e preços.
- **Payment**: Histórico de transações financeiras (compra única de GB, assinaturas, pagamentos por uso).
- **SystemConfig**: Armazenamento chave-valor no PostgreSQL para configurações dinâmicas e credenciais encriptadas.
- **UsageEvent**, **AuditLog**, **OneTimeToken**, **NodeShare**, **PointsLedger**, **WebhookEvent**: Suporte a auditoria, idempotência e rate-limiting.

### 2.3 Rotas de API Catalogadas (Total: 39 rotas)

1. **Autenticação**:
   - `POST /api/auth/login`: Autenticação por email/senha, validação Zod, rate-limiting, emissão de JWT (cookie HTTP-only `hivenode-token`).
   - `POST /api/auth/register`: Registro de novos usuários com role forçada `CUSTOMER`.
   - `POST /api/auth/logout`: Remoção do cookie de sessão.
   - `GET /api/auth/me`: Dados do usuário autenticado, contadores de nós, faturas e taxa de conversão.
   - `POST /api/auth/forgot-password`: Envio de e-mail com token temporário assinado via JWT.
   - `POST /api/auth/reset-password`: Consumo atômico de `OneTimeToken` e alteração da senha.
   - `GET /api/auth/qr-link`: Geração de token temporário para pareamento via QR Code.
   - `POST /api/auth/qr-login`: Login de nó Android via leitura de QR Code.
   - `GET / POST /api/auth/pair-code`: Pareamento via código de 6 caracteres no Redis.
   - `POST /api/auth/device-code/generate`: Geração de código para terminais CLI.
   - `POST /api/auth/device-code/approve`: Aprovação no painel web pelo usuário logado.
   - `POST /api/auth/device-code/poll`: Polling pelo cliente CLI para obter token de sessão.

2. **Administração (`/api/admin/*`)**:
   - `GET /api/admin`: Listagem completa de usuários, nós, proxies e assinaturas (exclusivo ADMIN).
   - `PUT / DELETE /api/admin/nodes/[id]`: Alteração de status e remoção de nós.
   - `GET / POST /api/admin/payment-key`: Leitura mascarada e gravação encriptada das chaves do AbacatePay.
   - `GET / POST / PUT /api/admin/plans`: CRUD de planos de precificação.
   - `PUT / DELETE /api/admin/proxies/[id]`: Bloqueio e remoção de credenciais de proxy.
   - `GET / PUT /api/admin/settings`: Leitura e atualização das configurações globais e crypto.
   - `PUT / DELETE /api/admin/subscriptions/[id]`: Gestão de assinaturas.
   - `PUT / DELETE /api/admin/users/[id]`: Gestão de saldo, cargos, carteiras e bloqueio de usuários.
   - `POST /api/admin/users/[id]/subscription`: Concessão manual de planos a usuários.

3. **Operações do Usuário (Nós, Proxies, B2B)**:
   - `GET / POST /api/nodes`: Listagem e registro de novos nós.
   - `PATCH / DELETE /api/nodes/[id]`: Renomeação, tags e exclusão de nós do usuário.
   - `GET /api/nodes/available`: Nós disponíveis para conexão.
   - `GET / POST /api/proxies`: Listagem e criação de credenciais SOCKS5.
   - `DELETE /api/proxies/[id]`: Remoção de credencial e invalidação no broker.
   - `POST /api/proxies/[id]/rotate`: Rotação instantânea de senha SOCKS5.
   - `GET / POST / PATCH /api/shares`: Compartilhamento B2B de nós privados.

4. **Faturamento & Webhooks**:
   - `POST /api/billing/checkout`: Compra avulsa de pacotes de GB via PIX.
   - `POST /api/billing/subscribe`: Contratação de planos recorrentes da Frota Privada.
   - `POST /api/billing/redeem-points`: Conversão de $HIVE Points em GB de tráfego.
   - `POST /api/webhooks/abacatepay`: Recepção e liquidação de eventos do gateway AbacatePay.

5. **Integração Interna com Broker Go**:
   - `POST /api/internal/node-auth`: Validação de handshake HMAC de nós conectando via túnel WebSocket.
   - `POST /api/internal/proxy-auth`: Autenticação SOCKS5h com verificação de cota e rate limit.
   - `POST /api/internal/usage`: Registro transacional idempotente de bytes consumidos e emissão de pontos.

6. **Utilitários e Scripts**:
   - `GET /api/health`: Healthcheck HTTP (PostgreSQL + Redis).
   - `GET /api/plans`: Listagem pública de planos disponíveis.
   - `POST /api/dashboard-ticket`: Emissão de ticket temporário para stream WebSocket.
   - `GET /cli.sh`: Script shell POSIX do cliente.
   - `GET /install.sh`: Instalador autônomo do `hivecli`.
   - `GET /api/clean`: Endpoint desativado (retorna 410 Gone).

---

## 3. Catálogo Detalhado de Defeitos e Vulnerabilidades

### 3.1 Falhas Críticas (Severidade: CRÍTICO)

#### [WEB-CRIT-01] Middleware do Next.js Inoperante por Nome de Arquivo Incorreto
- **Arquivo**: `web/src/proxy.ts` (Linhas 1 a 21)
- **Causa Raiz**: O arquivo responsável pela proteção e redirecionamento de rotas foi nomeado como `src/proxy.ts` exportando a função `proxy`. Segundo a especificação do Next.js App Router, o middleware deve obrigatoriamente se chamar `middleware.ts` (ou `middleware.js`) na raiz ou dentro de `src/`, exportando uma função `middleware` (ou default). Como resultado, o Next.js ignora completamente este arquivo. Nenhuma das verificações no matcher `["/saas/:path*", "/miner/:path*", "/admin/:path*"]` é executada na camada de borda/requisição.
- **Evidência**:
  ```ts
  // web/src/proxy.ts:4
  export async function proxy(request: NextRequest) { ... }
  export const config = { matcher: ["/saas/:path*", "/miner/:path*", "/admin/:path*"] };
  ```
- **Impacto**: Falha de arquitetura e segurança. A camada de middleware está inativa. Embora haja verificação subsequente em layouts de páginas como `AdminLayout`, a validação antecipada de sessão, desativação de usuário e bloqueio de escopo (`device`) deixa de ocorrer no gateway do Next.js. Além disso, se renomeado diretamente, o arquivo falhará no Edge Runtime por importar `@prisma/client` convencional.

---

#### [WEB-CRIT-02] Crash em Tempo de Execução na Rota de Compartilhamento B2B (`z.email()`)
- **Arquivo**: `web/src/app/api/shares/route.ts` (Linha 18)
- **Causa Raiz**: A rota `POST /api/shares` tenta validar o e-mail utilizando `email: z.email()`. Na biblioteca Zod (tanto v3 quanto v4), a validação de e-mail é feita através de `z.string().email()`; a função `z.email()` não existe e resulta em `TypeError: z.email is not a function`.
- **Evidência**:
  ```ts
  // web/src/app/api/shares/route.ts:18
  const body = z.object({ nodeId: z.string().uuid(), email: z.email(), maxProxies: z.number().int().min(1).max(100).default(1) }).parse(await request.json());
  ```
- **Impacto**: Toda requisição para convidar um parceiro B2B ou compartilhar um nó privado quebra imediatamente com erro 500 no backend.

---

#### [WEB-CRIT-03] Crash de Banco por Exceção de Ponteiro Nulo ao Registrar Uso de Nós Sem Proprietário
- **Arquivo**: `web/src/app/api/internal/usage/route.ts` (Linhas 21-25)
- **Causa Raiz**: No modelo `Node` do Prisma (`schema.prisma:55`), o campo `userId` é opcional (`userId String?`), suportando nós de datacenter ou infraestrutura não vinculados a um usuário individual. Na rota de telemetria interna `/api/internal/usage`, se o nó for público e não pertencer ao usuário do proxy, o código executa:
  `if (proxy.node.userId !== proxy.userId)`
  Quando `proxy.node.userId` é `null`, a condição é verdadeira (`null !== userId`), e a linha seguinte tenta executar:
  `await tx.user.update({ where: { id: proxy.node.userId! }, data: { hivePoints: { increment: points } } });`
  Passando `id: null` para a cláusula `where`, o cliente Prisma lança uma exceção de validação e aborta a transação serializável.
- **Evidência**:
  ```ts
  // web/src/app/api/internal/usage/route.ts:21-25
  if (proxy.node.userId !== proxy.userId) {
    const points = gb * 100;
    await tx.user.update({ where: { id: proxy.node.userId! }, data: { hivePoints: { increment: points } } });
    await tx.pointsLedger.create({ data: { userId: proxy.node.userId!, amount: points, type: "TRAFFIC" } });
  }
  ```
- **Impacto**: Quando nós compartilhados ou públicos sem usuário proprietário atribuído processam tráfego, o endpoint interno do broker falha em registrar o consumo, resultando em erro no broker Go e perda de contabilidade de tráfego.

---

#### [WEB-CRIT-04] Chave Secreta HMAC Pública Hardcoded no Código do Webhook
- **Arquivo**: `web/src/app/api/webhooks/abacatepay/route.ts` (Linha 6 e Linhas 16-17)
- **Causa Raiz**: O webhook do AbacatePay contém uma chave pública/secreta codificada estaticamente no código-fonte (`publicKey = "t9dXRhHHo3y..."`), e calcula o HMAC SHA-256 usando essa string fixa. Além de expor credenciais no repositório, há uma divergência direta com a biblioteca `src/lib/abacatepay.ts:153-157`, que define a verificação de assinatura utilizando o segredo configurado em banco/ambiente com digest hexadecimal.
- **Evidência**:
  ```ts
  // web/src/app/api/webhooks/abacatepay/route.ts:6
  const publicKey = "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";
  ...
  const expected = createHmac("sha256", publicKey).update(raw).digest("base64");
  ```
- **Impacto**: Falha grave de segurança. Qualquer agente externo em posse do código pode forjar assinaturas de webhook e aprovar pagamentos ou adicionar saldos de GB na plataforma.

---

#### [WEB-CRIT-05] `JWT_SECRET` Inválido no Arquivo de Ambiente de Desenvolvimento
- **Arquivo**: `web/.env` (Linha 3)
- **Causa Raiz**: O arquivo `web/.env` define `JWT_SECRET="hivenode_dev_secret_2026"`, que possui 23 caracteres. No entanto, `web/src/lib/auth.ts:17` valida expressamente:
  `if (!value || value.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");`
- **Evidência**:
  ```ini
  # web/.env:3
  JWT_SECRET="hivenode_dev_secret_2026"
  ```
  ```ts
  // web/src/lib/auth.ts:17
  if (!value || value.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  ```
- **Impacto**: Qualquer tentativa de subir ou testar a aplicação utilizando o arquivo `.env` local fornecido no repositório quebra imediatamente em qualquer operação de login ou geração de token.

---

### 3.2 Falhas de Alta Severidade (Severidade: ALTO)

#### [WEB-HIGH-01] Validação Zod Quebrada na Atualização de Assinaturas
- **Arquivo**: `web/src/app/api/admin/subscriptions/[id]/route.ts` (Linha 15)
- **Causa Raiz**: O handler PUT invoca `z.enum(SubStatus)` e `z.enum(PlanType)`. `SubStatus` e `PlanType` são objetos gerados pelo Prisma Client contendo mapeamento chave-valor de enum. O validador `z.enum()` exige uma tupla de strings `[string, ...string[]]`. No Zod clássico, a passagem de um objeto provoca falha ou rejeição de tipos.
- **Evidência**:
  ```ts
  // web/src/app/api/admin/subscriptions/[id]/route.ts:15
  const body = z.object({ status: z.enum(SubStatus), planType: z.enum(PlanType).optional() }).parse(await request.json());
  ```
- **Impacto**: Ao acionar a atualização de status de assinatura pelo painel administrativo (`/dashboard/admin/subscriptions`), a requisição PUT é rejeitada com erro de validação.

---

#### [WEB-HIGH-02] Incompatibilidade entre Frontend e Backend na Ação "Sync AbacatePay"
- **Arquivo**: `web/src/app/dashboard/admin/plans/page.tsx` (Linhas 91-95) e `web/src/app/api/admin/plans/route.ts` (Linhas 62-89)
- **Causa Raiz**: O botão "Sync AbacatePay" no painel administrativo envia um `POST /api/admin/plans` com `{ action: "sync_abacatepay" }`. O endpoint do backend, contudo, não possui nenhum condicional para `action`; ele assume que a requisição é de criação de plano e executa `prisma.plan.create({ data: { slug: body.slug, name: body.name, ... } })`. Como os campos são indefinidos, a operação falha no banco de dados.
- **Evidência**:
  ```tsx
  // web/src/app/dashboard/admin/plans/page.tsx:91-95
  const res = await fetch("/api/admin/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sync_abacatepay" }),
  });
  ```
- **Impacto**: A funcionalidade de sincronização de produtos com o gateway de pagamento AbacatePay no painel administrativo sempre retorna erro 500.

---

#### [WEB-HIGH-03] Limite Rígido Inadequado de 1 MB na Telemetria de Tráfego do Broker
- **Arquivo**: `web/src/app/api/internal/usage/route.ts` (Linhas 6-7)
- **Causa Raiz**: O schema de validação define `bytesRx: z.number().int().min(0).max(1048576)` e `bytesTx: z.number().int().min(0).max(1048576)`. 1.048.576 bytes equivale a exatamente 1 MiB. Se o broker Go agregar métricas de tráfego de sessões ativas e enviar relatórios com mais de 1 MB acumulado, a validação do Zod falha e retorna HTTP 400.
- **Evidência**:
  ```ts
  // web/src/app/api/internal/usage/route.ts:6-7
  const schema = z.object({ id: z.string().uuid(), proxyId: z.string().uuid(), nodeId: z.string().uuid(),
    bytesRx: z.number().int().min(0).max(1048576), bytesTx: z.number().int().min(0).max(1048576) });
  ```
- **Impacto**: Tráfego de clientes em conexões pesadas que acumulem mais de 1 MB antes da notificação é descartado pela API web, causando divergência contábil e impedindo a tarifação justa.

---

#### [WEB-HIGH-04] Instanciação Incorreta do Adapter `@prisma/adapter-pg` em `clean.js`
- **Arquivo**: `web/clean.js` (Linha 5)
- **Causa Raiz**: O script de limpeza passa um objeto literal `{ connectionString: process.env.DATABASE_URL }` para o construtor `PrismaPg`, em vez de passar uma instância de pool do driver `pg` (`new pg.Pool(...)`).
- **Evidência**:
  ```js
  // web/clean.js:5
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  ```
  Comparado com `web/src/lib/prisma.ts:20-26`:
  ```ts
  const pool = new pg.Pool({ connectionString: dbUrl, ... });
  const adapter = new PrismaPg(pool);
  ```
- **Impacto**: O script de manutenção `clean.js` falha imediatamente ao ser invocado.

---

#### [WEB-HIGH-05] Dependência Externa Quebrada via Caminho Relativo em `local-integration.ts`
- **Arquivo**: `web/scripts/local-integration.ts` (Linhas 15-16)
- **Causa Raiz**: O script de teste de integração importa o módulo `ws` através de um caminho relativo cruzado apontando para `../../hivedocker/node_modules/ws`.
- **Evidência**:
  ```ts
  // web/scripts/local-integration.ts:16
  const WebSocket = require("../../hivedocker/node_modules/ws");
  ```
- **Impacto**: Em qualquer ambiente onde o `hivedocker` não tenha sido instalado ou em containers Docker onde o contexto do build é restrito ao diretório `web/`, o teste de integração falha com erro de módulo não encontrado (`MODULE_NOT_FOUND`).

---

### 3.3 Falhas de Média Severidade (Severidade: MÉDIO)

#### [WEB-MED-01] Resposta HTTP 500 Indevida em Token de Reset de Senha Expirado ou Já Consumido
- **Arquivo**: `web/src/app/api/auth/reset-password/route.ts` (Linhas 41, 50-53)
- **Causa Raiz**: Quando um token já foi consumido ou expirou no banco, a cláusula `consumed.count !== 1` lança um `new Error("Token já utilizado ou expirado")`. Essa exceção é capturada pelo bloco `catch (error)`, que retorna HTTP 500 em vez de HTTP 400/401.
- **Evidência**:
  ```ts
  // web/src/app/api/auth/reset-password/route.ts:41
  if (consumed.count !== 1) throw new Error("Token já utilizado ou expirado");
  ...
  // Linha 52:
  return apiError("Erro ao redefinir a senha", 500);
  ```
- **Impacto**: Erro do cliente (link expirado) é reportado como falha catastrófica interna do servidor.

---

#### [WEB-MED-02] Quebra Fatal na Rota de Esqueci Minha Senha Quando `NEXT_PUBLIC_APP_URL` Está Indefinido
- **Arquivo**: `web/src/app/api/auth/forgot-password/route.ts` (Linhas 26-27)
- **Causa Raiz**: Se a variável de ambiente `NEXT_PUBLIC_APP_URL` não for configurada no host, a rota lança explicitamente `throw new Error("NEXT_PUBLIC_APP_URL is required")`, caindo no bloco `catch` e retornando HTTP 500, sem fallback para a URL da requisição (`request.url`).
- **Evidência**:
  ```ts
  // web/src/app/api/auth/forgot-password/route.ts:26-27
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_APP_URL is required");
  ```
- **Impacto**: Usuários não conseguem solicitar redefinição de senha se a variável opcional de URL pública não tiver sido injetada.

---

#### [WEB-MED-03] Cálculo Ingênuo de Próximo Período de Cobrança sem Tratar Rollover de Mês
- **Arquivo**: `web/src/app/api/billing/subscribe/route.ts` (Linhas 85-86)
- **Causa Raiz**: O endpoint utiliza a mutação ingênua `nextPeriod.setMonth(nextPeriod.getMonth() + 1)`. Em dias 29, 30 ou 31, somar 1 mês em JavaScript salta dias ou pula para o mês subsequente (ex: 31 de janeiro vira 2 ou 3 de março). O projeto possui um utilitário dedicado `nextBillingPeriod` em `src/lib/billing-period.ts:1-10` especificamente para evitar essa anomalia, mas o endpoint não o utilizou.
- **Evidência**:
  ```ts
  // web/src/app/api/billing/subscribe/route.ts:85-86
  const nextPeriod = new Date();
  nextPeriod.setMonth(nextPeriod.getMonth() + 1);
  ```
- **Impacto**: Assinaturas criadas no final do mês sofrem distorção de datas de faturamento e vencimento antecipado/tardio.

---

#### [WEB-MED-04] Retorno de Código 403 Forbidden ao Resgatar Pontos sem Saldo Suficiente
- **Arquivo**: `web/src/app/api/billing/redeem-points/route.ts` (Linhas 18, 25)
- **Causa Raiz**: Se o usuário não tiver saldo suficiente de pontos, o código executa `if (!debit.count) throw new Error("Forbidden")`. O manipulador `handleApiError` mapeia `"Forbidden"` para o status HTTP 403.
- **Evidência**:
  ```ts
  // web/src/app/api/billing/redeem-points/route.ts:18
  if (!debit.count) throw new Error("Forbidden");
  ```
- **Impacto**: Saldo insuficiente é uma violação de regra de negócio (HTTP 400), não de autorização/permissão (HTTP 403).

---

#### [WEB-MED-05] Concessão Manual de Assinatura Grava `planType` Fictício "FREE" no Banco
- **Arquivo**: `web/src/app/api/admin/users/[id]/subscription/route.ts` (Linha 45)
- **Causa Raiz**: Na concessão administrativa de planos para um usuário, o endpoint preenche o campo obrigatório `planType` com a constante `"FREE"` em vez de obter o tipo real do plano a partir do registro do plano (`plan.slug` mapeado para o enum `PlanType`).
- **Evidência**:
  ```ts
  // web/src/app/api/admin/users/[id]/subscription/route.ts:45
  planType: "FREE", // Usaremos FREE como dummy já que o plano real tem o ID
  ```
- **Impacto**: Consultas, relatórios e filtros de assinaturas ativas por `planType` mostram assinaturas Pro, Starter e Enterprise manuais incorretamente classificadas como gratuitas.

---

#### [WEB-MED-06] Inconsistência de Preço de Planos Padrão entre Seed e Fallback da API
- **Arquivo**: `web/prisma/seed-plans.ts` (Linha 38) vs `web/src/app/api/admin/plans/route.ts` (Linha 34)
- **Causa Raiz**: O script de seed define o plano Starter com `priceInCents: 4990` (R$ 49,90). O fallback da API administrativa em `GET /api/admin/plans` insere o Starter com `priceInCents: 2990` (R$ 29,90). Além disso, o arquivo `package.json` não configura a chave `"prisma": { "seed": "..." }`, inviabilizando o comando padrão `npx prisma db seed`.
- **Evidência**:
  ```ts
  // web/prisma/seed-plans.ts:38
  priceInCents: 4990, // R$ 49,90
  
  // web/src/app/api/admin/plans/route.ts:34
  priceInCents: 2990,
  ```
- **Impacto**: O preço do plano Starter varia dependendo se a base de dados foi inicializada via seed manual ou via primeiro carregamento do painel administrativo.

---

#### [WEB-MED-07] Supressão Silenciosa de Erros na Descriptografia Criptográfica
- **Arquivo**: `web/src/lib/crypto.ts` (Linhas 43-46)
- **Causa Raiz**: A função `decrypt(payload)` captura qualquer erro no bloco `try...catch` e retorna uma string vazia `""` sem lançar exceção.
- **Evidência**:
  ```ts
  // web/src/lib/crypto.ts:43-46
  } catch (e) {
    console.error("Falha ao descriptografar dado:", e);
    return "";
  }
  ```
- **Impacto**: Se a chave de criptografia for alterada ou um dado corrompido, a função retorna secret vazio. Chamadores que esperavam credenciais válidas operam sobre strings vazias sem falha imediata explícita.

---

### 3.4 Falhas de Baixa Severidade e Débitos Arquiteturais (Severidade: BAIXO)

#### [WEB-LOW-01] Componentes Administrativos Órfãos / Dead Code
- **Arquivos**:
  - `web/src/components/admin/AdminOverview.tsx`
  - `web/src/components/admin/AdminUsersTab.tsx`
  - `web/src/components/admin/AdminNodesTab.tsx`
  - `web/src/components/admin/AdminProxiesTab.tsx`
- **Causa Raiz**: Esses quatro componentes em aba foram substituídos pelas páginas dedicadas do App Router (`dashboard/admin/page.tsx`, `dashboard/admin/users/page.tsx`, etc.), mas permaneceram no repositório sem qualquer importação ativa.
- **Impacto**: Aumento de ruído cognitivo, manutenção fantasma e código morto.

---

#### [WEB-LOW-02] Diretório Órfão Vazio `web/worker/`
- **Arquivo**: `web/worker/` (diretório vazio)
- **Causa Raiz**: O serviço de background worker é executado a partir de `web/src/lib/worker.ts` (conforme `package.json:11` e `Dockerfile:35`). O diretório `web/worker` está vazio.
- **Impacto**: Desorganização estrutural.

---

#### [WEB-LOW-03] Arquivo de Migração Vazio `20260909000000_initial`
- **Arquivo**: `web/prisma/migrations/20260909000000_initial/migration.sql`
- **Causa Raiz**: O arquivo de migração inicial contém apenas um comentário `-- Generated from the validated schema by prisma migrate diff.` sem qualquer instrução SQL DDL. Toda a criação de tabelas foi empurrada para a migração subsequente `20261013000000_create_schema`.
- **Impacto**: Histórico de migrações desnecessariamente fragmentado.

---

#### [WEB-LOW-04] Tratamento Impróprio de Erros de Permissão em Rotas Administrativas
- **Arquivos**:
  - `web/src/app/api/admin/payment-key/route.ts` (Linha 30-33)
  - `web/src/app/api/admin/plans/route.ts` (Linha 55-58)
- **Causa Raiz**: O helper `requireAdmin()` lança `new Error("Forbidden")` se o usuário autenticado não tiver o papel ADMIN. O bloco `catch` dessas rotas apenas checa `error.message === "Unauthorized"` para retornar 401; caso a mensagem seja `"Forbidden"`, ele retorna HTTP 500 em vez de 403.
- **Evidência**:
  ```ts
  // web/src/app/api/admin/payment-key/route.ts:30-33
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao verificar chave", 500);
  }
  ```
- **Impacto**: Clientes não administradores recebem erro 500 (falha interna) em vez de 403 (acesso negado).

---

## 4. Análise de Segurança, RBAC e IDOR

A auditoria inspecionou exaustivamente todas as rotas em busca de vazamentos de dados, falhas de controle de acesso (RBAC) e vulnerabilidades de referência direta insegura a objetos (IDOR):

1. **RBAC (Role-Based Access Control)**:
   - A função `requireAdmin()` em `src/lib/auth.ts:85-89` é chamada consistentemente nos endpoints administrativos. Além disso, `dashboard/admin/layout.tsx` realiza uma verificação direta no banco antes de renderizar páginas administrativas.
   - O registro público (`POST /api/auth/register`) força o papel `CUSTOMER`, impedindo escalação de privilégio no momento do cadastro.
   - Na edição administrativa de usuários (`PUT /api/admin/users/[id]`), foi implementada proteção para impedir que o administrador revogue o próprio acesso ou desative a própria conta (`if (id === actor.userId ...)`).

2. **Isolamento de Tenant & Prevenção de IDOR**:
   - `DELETE /api/nodes/[id]`: Verifica se `userId === payload.userId`.
   - `PATCH /api/nodes/[id]`: Verifica se `node.userId === payload.userId`.
   - `DELETE /api/proxies/[id]`: Verifica se `proxy.userId === payload.userId`.
   - `POST /api/proxies/[id]/rotate`: Verifica se `proxy.userId === payload.userId`.
   - `POST /api/shares`: Verifica se o proprietário do nó é o usuário autenticado e se a visibilidade é `PRIVATE`.
   - `PATCH /api/shares`: Valida se o e-mail do usuário bate com `sharedWithEmail` ao aceitar e se o usuário é o `ownerId` ao revogar.

3. **Criptografia & Proteção de Segredos**:
   - As senhas dos usuários utilizam `bcryptjs` com custo de 12 rounds.
   - As senhas de proxy e secrets de túnel são cifradas em repouso com AES-256-GCM via derivação de chave scrypt.
   - A chave de API do AbacatePay é encriptada no banco na tabela `SystemConfig`.
   - **Vulnerabilidade**: Exposição da chave HMAC em texto claro no webhook (`WEB-CRIT-04`).

---

## 5. Conclusão da Auditoria do Módulo `web`

O módulo `web` apresenta uma boa arquitetura de dados e implementa defesas consistentes contra IDOR e injeção de parâmetros na maioria das rotas transacionais. No entanto, possui defeitos críticos de implementação que inviabilizam rotas específicas em produção (como `POST /api/shares` pelo uso de `z.email()`, a inoperância total do middleware por nomenclatura errônea em `proxy.ts`, o risco de corrupção contábil no registro de nós datacenter sem usuário, e a exposição de chaves no webhook do AbacatePay).
