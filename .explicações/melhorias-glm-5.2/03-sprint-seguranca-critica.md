# Sprint 3 — Segurança Crítica

> Faixa: 3-6 dias de trabalho. Itens de的一面posição de risco, conformidade fiscal e vazamento de dados.
> Objetivo: Zero vazamento em APK/dump DB; webhooks idempotentes; cookies/segredos isolados; fiscal auditável.

---

## 1. S1 — Segredo HMAC hardcoded em 4 codebases

### Por que mudar
- `"hivenode_secret_key"` hardcoded em:
  - `broker/internal/tunnel/websocket.go:215` — assina WS do broker.
  - `hivenode-app/src/app/index.tsx:51` — assina WS do app privado.
  - `hiveminer-app/src/app/index.tsx:51` — assina WS do app miner.
  - `hivedocker/server.js:48` — assina WS do nó Docker.
- Qualquer pessoa que fizer APK reverse (JADX, apktool) ou dump do binário Go tem a **chave universal** de impersonificação de nó.
- Pode criar WS falso com qualquer `nodeId`, interceptar credenciais, ou estabelecer túnel falso.

### Melhoria esperada
- Segredo por usuário gerado no `User.register` (campo `tunnelSecret`).
- Segredo assinado dentro do JWT do app.
- Cada nó só pode assinar HMAC p/ o próprio ID.
- Quebra de isolamento mesmo em leak do APK — sem segredo universal.

### Passos e arquivos a editar

**Arquivo:** `web/prisma/schema.prisma`

Adicionar field:

```prisma
model User {
  // ...existente
  tunnelSecret   String       @default(uuid())   // segredo HMAC por usuário
}
```

Rodar `npx prisma db push` (ou migrate deploy quando E10 estiver aplicado).

**Arquivo:** `web/src/lib/auth.ts`

No `generateToken`, incluir `tunnelSecret` no payload:

```ts
export async function generateToken(userId: string, role: string, tunnelSecret?: string): Promise<string> {
  return await new SignJWT({ userId, role, tunnelSecret })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}
```

**Arquivo:** `web/src/app/api/auth/login/route.ts` e `/register/route.ts`

Buscar `user.tunnelSecret` e incluir no retorno da API.

**Arquivo:** `hivenode-app/src/app/index.tsx` (e `hiveminer-app`, `hivedocker/server.js`)

Manter `serverIp` e `nodeId` no AsyncStorage/config. Buscar `tunnelSecret` do JWT ao fazer login QR/email e guardar também:

```ts
const tunnelSecret = loginData.data.user.tunnelSecret;
await AsyncStorage.setItem("tunnelSecret", tunnelSecret);
```

Trocar o `getWsUrl`:

```ts
const getWsUrl = (address: string, nodeId: string, secret: string) => {
  const isProd = address.includes("alfastage.com.br");
  const hmacSig = CryptoJS.HmacSHA256(nodeId, secret).toString(CryptoJS.enc.Hex);
  const proto = isProd ? "wss" : "ws";
  return `${proto}://${address}/tunnel?nodeId=${nodeId}&sig=${hmacSig}`;
};
```

**Arquivo:** `broker/internal/tunnel/websocket.go`

Mudar `HandleWS` linha 215:

```go
func (tm *TunnelManager) getTunnelSecret(nodeID string) []byte {
    // Buscar no Redis `user_tunnel_secret:{nodeId}` setado pela API Next.js
    secret, err := tm.redisClient.Get(context.Background(), "user_tunnel_secret:"+nodeID).Result()
    if err != nil || secret == "" {
        return []byte("fallback_should_not_happen") // ou rejeitar
    }
    return []byte(secret)
}

// no HandleWS:
expectedMAC := hex.EncodeToString(hmac.New(sha256.New, tm.getTunnelSecret(nodeID)).Sum(nil))
```

**Arquivo:** `web/src/app/api/nodes/route.ts`

Ao criar Node, gravar no Redis:

```ts
const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { tunnelSecret: true } });
await redis.set(`user_tunnel_secret:${node.id}`, user.tunnelSecret);
```

### Verificação
- APK decompilado (JADX) não expõe segredo fixo.
- Mesmo nodeId com secret velho → broker rejeita WS 401.
- Trocar senha/renovar tunnelSecret → reconectar worker fica impossível até app sincronizar.

---

## 2. S5 — `proxyPass` gravado em texto plano

### Por que mudar
- `web/src/app/api/proxies/route.ts:67` grava `proxy:{user} = nodeId:proxyPassPlain` no Redis.
- Igualmente `ProxyCredential.proxyPass` em texto plano no Postgres.
- Snapshot/dump do Redis → todas credenciais SOCKS5 vazam.
- Backup do Postgres → mesma exposição.
- Mesmo se o broker precisar da senha p/ comparar, ele pode receber uma função hash bcrypt comparando no Redis (com `VERIFY` script Lua).

### Melhoria esperada
- Postgres: `proxyPass` como bcrypt hash (para UI validar).
- Redis: password criptografada AES-256-GCM usando `ENCRYPTION_KEY` (já existe no `.env`).
- Broker decrypta em runtime com env.
- Dump do DB/Redis não expõe senhas.

### Passos e arquivos a editar

**Arquivo:** `web/src/lib/crypto.ts` (novo)

```ts
import crypto from "crypto";

const KEY = process.env.ENCRYPTION_KEY;
if (!KEY || KEY.length < 32) throw new Error("ENCRYPTION_KEY inválida");

const key = crypto.scryptSync(KEY, "hivenode-salt", 32);

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // GCM nonce
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${enc}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, enc] = payload.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(enc, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

export async function bcryptHash(text: string): Promise<string> {
  return await bcryptjs.hash(text, 12);
}

export async function bcryptCompare(text: string, hash: string): Promise<boolean> {
  return await bcryptjs.compare(text, hash);
}
```

**Arquivo:** `web/src/app/api/proxies/route.ts`

```ts
const maskedPass = bcryptHash(proxyPass);           // p/ Postgres
const encryptedRedis = encrypt(proxyPass);          // p/ Redis

const proxy = await prisma.proxyCredential.create({
  data: { userId, nodeId, proxyUser, proxyPass: maskedPass }
});

await redis.set(`proxy:${proxyUser}`, `${nodeId}:${encryptedRedis}`);
```

**Arquivo:** `broker/internal/redis/client.go`

O broker precisa do plaintext p/ comparar. Solução mais simples: script Lua no Redis que recebe a senha candidata, hace decrypt (impraticável em Lua sem libs). Melhor: broker não compara em Redis, ele só faz lookup; comparação fica em Lua que faz hash SHA-256 do input e compara com o hash armazenado também SHA-256 + pepper.

**Alternativa simples (mantém bcrypt no Postgres, mas bcrypt não dá p/ Redis lookup):**

Para não aumentar latência do SOCKS5 (Redis em ms), usamos:
- Redis armazena `proxy:{user} = nodeId:bcryptHash` (bcrypt com custo 4 só p\ lookup rápido — ainda seguro p/ força bruta em 5 tentativas rate limited).
- Broker usa `bcrypt.CompareHashAndPassword` (custo 4 é ~1ms).

Atualizar `ValidateSOCKS5User`:

```go
import "golang.org/x/crypto/bcrypt"

func (c *Client) ValidateSOCKS5User(ctx context.Context, username, password string) (string, string, error) {
    // ... rate limit igual a antes
    val, err := c.Get(ctx, "proxy:"+username).Result()
    // val = "nodeId:bcryptHash[:PUBLIC]"
    parts := strings.SplitN(val, ":", 3)
    if len(parts) < 2 { return "", "", fmt.Errorf("credencial inválida") }
    nodeId := parts[0]
    hashed := parts[1]
    nodeType := "PRIVATE"
    if len(parts) == 3 { nodeType = parts[2] }
    
    if bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password)) != nil {
        return "", "", fmt.Errorf("senha do proxy incorreta")
    }
    c.Del(ctx, rlKey)
    return nodeId, nodeType, nil
}
```

Adicionar ao `broker/go.mod`:

```
require golang.org/x/crypto v0.31.0
```

### Verificação
- `redis-cli GET proxy:joao` → `id:bchash...` (não plaintext).
- `SELECT proxyPass FROM proxy_credentials` → bcrypt `$2b$12$...`.
- Recriar proxy com mesma senha gera hash diferente (salt), broker valida OK.

---

## 3. S9 — `.env` com segredos reais no repo

### Por que mudar
- Consegui ler `C:\Users\theja\HiveNode\.env` — segredo JWT, AbacatePay API key, senha Redis, JWT_SECRET completo.
- Se o histórico git引 para GitHub (mesmo private), segredo vazou permanentemente (git history scraping é trivial).

### Melhoria esperada
- Segredos fora do repo.
- Rotação de chaves não exige commit/redeploy.
- Conformidade básica LGPD/GDPR p/ operação financeira.

### Passos e arquivos a editar

**Passo 1:** Rotacionar **imediatamente** todos os segredos:
- Novo `JWT_SECRET` (`openssl rand -hex 48`).
- Novo `ENCRYPTION_KEY` (`openssl rand -hex 32`).
- Nova API Key AbacatePay via painel.
- Novo webhook secret AbacatePay.
- Nova senha Redis (e volumes `flushall` ou novo volume).

**Passo 2:** Roterar segredos:
- Manter `.env` contendo só placeholders seguros (ver abaixo).
- Segredos reais → Coolify env vars ou `.env.local`/`.env.production` no host, fora do repo.

**Arquivo:** `.gitignore`

```gitignore
.env
.env.local
.env.production
.env.*.local
web/.env
broker/.env
```

**Arquivo:** Novo `.env.example` (repo):

```env
COMPOSE_PROJECT_NAME=hivenode

DATABASE_URL="postgresql://USER:PASS@HOST:5432/hivenode?schema=public"
REDIS_URL="redis://:PASSWORD@HOST:6379/0"

JWT_SECRET="<openssl rand -hex 48>"
ENCRYPTION_KEY="<openssl rand -hex 32>"

ABACATE_PAY_API_KEY="<from AbacatePay dashboard>"
ABACATE_PAY_WEBHOOK_SECRET="<from AbacatePay dashboard>"
ABACATE_PAY_MODE="dev"
ABACATE_PAY_API_VERSION="v2"
ABACATE_PAY_WEBHOOK_ROUTE_URL="/webhook/abacatepay"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
WEB_PORT=3000

BROKER_SOCKS5_PORT=10000
BROKER_TUNNEL_PORT=10001
BROKER_BILLING_FLUSH_MB=5
BROKER_BILLING_FLUSH_SEC=30
```

**Passo 3:** Remover `.env` do histórico git (BFG Repo-Cleaner):
```bash
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Verificação
- `git log --all -p -- .env` → sem histórico.
- Novos segredos só existem em vars do Coolify ou `.env.local` host.

---

## 4. B5 — Webhook AbacatePay não-idempotente

### Por que mudar
- `web/src/app/api/webhooks/abacatepay/route.ts:52-192`:
  - Não tem checagem de eventId duplicado.
  - `checkout.completed` duplicado creditar GB duas vezes (race ou retry do AbacatePay).
  - `subscription.renewed` duplicado cria 2x `Payment`, dobra período p/ o próximo mês.
  - Em erros (500) o código retorna 200 indicando sucesso — AbacatePay não re-tentar, e o crédito se perde silenciosamente.

### Melhoria esperada
- Idempotência por `event.id` (ou `checkoutId + eventType`).
- Persistência em `webhook_events` p/ auditoria fiscal.
- Errors retornam 5xx (AbacatePay re-tenta).
- Conformidade financeira: reconciliação total.

### Passos e arquivos a editar

**Arquivo:** `web/prisma/schema.prisma`

```prisma
model WebhookEvent {
  id          String   @id @default(uuid())
  externalId  String   @unique  // event.id do AbacatePay
  eventType   String
  payload     Json
  processedAt DateTime @default(now())
  createdAt   DateTime @default(now())
  
  @@index([externalId, eventType])
  @@map("webhook_events")
}
```

**Arquivo:** `web/src/app/api/webhooks/abacatepay/route.ts`

Refatorar p/ padrão outbox:

```ts
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-abacate-signature") || "";
  
  // ... validar secret (S8)
  if (!secret) return apiError("Webhook não configurado", 500);
  if (!signature) return apiError("Missing signature", 401);
  if (!verifySignature(rawBody, signature, secret)) return apiError("Invalid signature", 401);
  
  const event = JSON.parse(rawBody);
  const externalId = event.id || event.data?.id;
  const eventType = event.type;
  
  if (!externalId) return apiError("Event ID missing", 400);
  
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Inserir idempotente: se já existir, transaction falha com P2002
      await tx.webhookEvent.create({
        data: { externalId: `${externalId}:${eventType}`, eventType, payload: event }
      });
      
      // 2. Processamento real
      await processWebhookEvent(event, tx);
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log(`[Webhook] Event ${externalId}:${eventType} já processado`);
      return apiSuccess({ received: true, duplicate: true }); // 200
    }
    console.error("[Webhook] Erro processando:", error);
    return apiError("Internal error", 500); // 5xx para AbacatePay re-tentar
  }
  
  return apiSuccess({ received: true });
}

async function processWebhookEvent(event: any, tx: any) {
  switch (event.type) {
    case "checkout.completed": { /* ... */ }
    case "checkout.refunded": { /* ... */ }
    case "subscription.completed":
    case "subscription.renewed": { /* ... */ }
    case "subscription.cancelled": { /* ... */ }
    default:
      console.log(`[Webhook] Não tratado: ${event.type}`);
  }
}
```

Trocar todos `prisma.payment` e `prisma.user` p/ `tx.payment` e `tx.user` para que o crédito GB seja atômico com o insert do webhookEvent.

### Verificação
- Chamar webhook 2x com mesmo `id` → só processa uma vez, segundo retorna `{ received: true, duplicate: true }`.
- Simular falha (Postgres down) → retorna 500, AbacatePay retém retry queue.

---

## 5. B7 — `prisma db push --accept-data-loss` no entrypoint do container

### Por que mudar
- `web/Dockerfile:80`: `npx prisma db push --accept-data-loss 2>&1 || echo "prisma push falhou..."`.
- Em deploys multi-réplica, cada pod roda db push — race condition.
- `--accept-data-loss` destroi colunas se schema mudou silenciosamente.
- Em produção, migrations não devem ser byte-left-to-chance — deve ser auditável.

### Melhoria esperada
- `prisma migrate deploy` roda só migrations versionadas.
- Zero risco de perda de dados.
- Deploys auditáveis (histórico de migrations).
- Multi-réplica segura.

### Passos e arquivos a editar

**Arquivo:** `web/Dockerfile`

Substituir `start.sh`:

```dockerfile
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🚀 Iniciando Next.js..."' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh
```

**Novo job de deploy no `docker-compose.yml`:**

```yaml
  migrate:
    build:
      context: ./web
      target: builder
    environment:
      - DATABASE_URL=postgresql://hivenode_user:hivenode_dev_2026@postgres:5432/hivenode?schema=public
    command: npx prisma migrate deploy
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - hivenode-net
    restart: "no"
```

Os serviços `web` e `broker` devem `depend_on: migrate: condition: service_completed_successfully`.

**Arquivo:** `web/package.json`

Adicionar script:
```json
"db:migrate:deploy": "prisma migrate deploy",
"db:migrate:dev": "prisma migrate dev --name init"
```

**Passo único:** Rodar `npx prisma migrate dev --name init` localmente p/ gerar a primeira migration do schema atual. Commitar `prisma/migrations/`.

### Verificação
- `docker compose up` → `migrate` roda primeiro e finaliza com sucesso → `web` sobe.
- `docker compose up web --scale web=3` → nenhum dos 3 tenta push, todos sobem sãos.

---

## 6. B8 — Comparação de strings não-timing-safe (timing attack)

### Por que mudar
- `web/src/app/api/webhooks/abacatepay/route.ts:14`: `signature === digest` permite timing attack para atacante forjar assinatura byte-by-byte.
- Mesma occurrences em broker (`broker/internal/redis/client.go:70`: `password != expectedPass`).

### Melhoria esperada
- `crypto.timingSafeEqual` (Node) e `subtle.ConstantTimeCompare` (Go: `crypto/subtle.ConstantTimeCompare`) protegem contra canal temporal.

### Passos e arquivos a editar

**Arquivo:** `web/src/app/api/webhooks/abacatepay/route.ts`

Já incluído no snippet de S8.

**Arquivo:** `broker/internal/redis/client.go`

```go
import "crypto/subtle"

// substituir:
// if password != expectedPass {
//     return "", "", fmt.Errorf("senha do proxy incorreta")
// }

// por:
if subtle.ConstantTimeCompare([]byte(password), []byte(expectedPass)) != 1 {
    return "", "", fmt.Errorf("senha do proxy incorreta")
}
```

### Verificação
- Timing attack em script bcrypt/SHA256 não é mais viável; `cheriot-audit` ou `gosec` não flaggeia.

---

## Resumo Sprint 3

| Item | Arquivos | Risk removido |
|---|---|---|
| S1 HMAC por usuário | `schema.prisma`, `auth.ts`, `hivenode-app/*`, `hiveminer-app/*`, `hivedocker/server.js`, broker | APK leak → 0 access |
| S5 bcrypt proxyPass | `lib/crypto.ts`, `proxies/route.ts`, `redis/client.go`, `go.mod` | Dump DB/Redis → 0 credenciais |
| S9 .env fora do repo | `.gitignore`, `.env.example`, BFG clean | Histórico git → 0 secrets |
| B5 webhook idempotente | `schema.prisma`, `webhooks/abacatepay/route.ts` | 0 double-spend fiscal |
| B7 migrate deploy | `Dockerfile`, `docker-compose.yml`, `package.json`, `prisma/migrations/` | 0 data loss em deploy |
| B8 timing-safe | `webhooks/abacatepay/route.ts`, `redis/client.go` | 0 timing attack |
