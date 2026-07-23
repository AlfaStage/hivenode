# Sprint 1 — Quick Wins (Correções Rápidas)

> Faixa: 1-3 dias de trabalho. Itens de baixo risco e alto impacto imediato.
> Objetivo: Corrigir bugs latentes, vazamentos de sockets, falhas silenciosas de webhook e UX de apps móveis.

---

## 1. B1 — Middleware checa cookie errado (`hivenode_token` vs `hivenode-token`)

### Por que mudar
- `web/src/middleware.ts:5` lê `request.cookies.get('hivenode_token')`.
- `web/src/lib/auth.ts:81` grava o cookie com nome `hivenode-token` (hífen).
- Resultado: o matcher em `/saas/:path*` e `/miner/:path*` nunca bloqueia ninguém — qualquer visitante consegue acessar rotas "privadas" se essas rotas voltarem a existir.
- Hoje está latente porque as rotas não estão montadas, masQualquer nova rota sob `/miner` ou `/saas` já nasceria pública.

### Melhoria esperada
- Rotas privadas realmente bloqueadas.
- Permite reativar o middleware para RBAC (CUSTOMER/ADMIN), rate-limit por IP, redirecionamento de login — sem precisar de middleware ad-hoc em cada handler.

### Passos e arquivos a editar

**Arquivo:** `web/src/middleware.ts`

1. Trocar a leitura do cookie de `hivenode_token` para `hivenode-token`.
2. Decodificar o JWT (HS256, sem.verify — só verificar expiração) para extrair `role`.
3. Redirecionar para `/login` quando ausente/expirado.
4. Bloquear `/admin/*` se `role !== "ADMIN"` (manter `/saas/*` e `/miner/*` só p/ autenticado).
5. Usar `jose.jwtVerify` (já é dependência) p/ evitar importar nada novo.

**Arquivo:** `web/src/lib/auth.ts` (revisar consistência)
- Confirmar que o nome do cookie (`TOKEN_COOKIE_NAME`) continua `hivenode-token` e bate com o middleware.

### Snippet de referência

```ts
// web/src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('hivenode-token')?.value;
  const path = request.nextUrl.pathname;

  if (!token && (path.startsWith('/saas') || path.startsWith('/miner'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!token && path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && path.startsWith('/admin')) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      if (payload.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/saas/:path*', '/miner/:path*', '/admin/:path*'],
};
```

### Verificação
- `curl -i http://localhost:3000/miner` sem cookie → 307 p/ `/login`.
- Logar e acessar `/admin/users` como CUSTOMER → redirecionamento p/ `/dashboard`.

---

## 2. B2 — `POST /api/proxies` cria nova conexão Redis por request

### Por que mudar
- `web/src/app/api/proxies/route.ts:8` faz `new Redis(process.env.REDIS_URL)` em cada chamada.
- Em rotas serverless ou instâncias longas isto gera:
  - Vazamento de sockets (cada `new Redis` abre pool de N conexões).
  - Picos de latência (handshake AUTH) no primeiro request após idle.
  - Atingir limite de conexões do Redis em pico.

### Melhoria esperada
- Reuso do singleton já exportado em `web/src/lib/redis.ts`.
- Latência de lookup p/ <1ms.
- Zero vazamento de sockets.

### Passos e arquivos a editar

**Arquivo:** `web/src/app/api/proxies/route.ts`

1. Remover line 6: `import Redis from "ioredis";`.
2. Remover line 8: `const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");`.
3. Adicionar no topo: `import { redis } from "@/lib/redis";`.
4. Substituir todas as chamadas `redis.set(...)` mantendo a mesma assinatura.

**Result final (trecho cabeça do arquivo):**

```ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { redis } from "@/lib/redis";          // reusa singleton
import { sendProxyAlert } from "@/lib/email";

export async function POST(request: NextRequest) {
  // ... resto inalterado
}
```

### Verificação
- `redis-cli CLIENT LIST | grep cmd` — você verá 1 conexão persistente, não 1 por request.

---

## 3. B3 — Broker monta JSON à mão no `/live-nodes`

### Por que mudar
- `broker/cmd/broker/main.go:53-69` tem um "Hack para importar encoding/json" que concatena string na mão:
  - ID de nó arbitrário injetável na string JSON.
  - Lento (	ArrayList  allocation por nó).
  - Importa `encoding/json` no topo mas não usa — retirando esse hack o `encoding/json` passa a ser usado.
- O encoding/json já está importado em `line 4`.

### Melhoria esperada
- JSON seguro e correto com `json.Marshal`.
- -50% CPU nesse endpoint sob polling.
- Memory allocation reduzida (marshal usa buffer pool interno).

### Passos e arquivos a editar

**Arquivo:** `broker/cmd/broker/main.go`

Substituir o handler `/live-nodes` (linhas 52-70) por:

```go
mux.HandleFunc("/live-nodes", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    nodes := tunnelManager.GetConnectedNodes()
    if err := json.NewEncoder(w).Encode(nodes); err != nil {
        http.Error(w, "encode error", http.StatusInternalServerError)
    }
})
```

### Verificação
- `curl http://localhost:10001/live-nodes` → JSON compacto de array de strings.
- `go vet ./...` não reporta "imported and not used".

---

## 4. S8 — Webhook AbacatePay aceita evento sem assinatura

### Por que mudar
- `web/src/app/api/webhooks/abacatepay/route.ts:32-38`:
  ```ts
  if (secret && signature) {
    if (!verifySignature(rawBody, signature, secret)) { ... }
  }
  ```
- Se `signature` estiver vazio (cabeçalho removido por atacante), o `&&` short-circuit e o webhook segue processando o evento malicioso **sem validar HMAC**.
- Permite forjar PIX pago, creditar GB grátis, reativar assinatura cancelada.

### Melhoria esperada
- Webhook sempre autenticado.
- Atacante chama endpoint sem assinatura → 401.
- Compara com `crypto.timingSafeEqual` p/ evitar timing attack na assinatura.

### Passos e arquivos a editar

**Arquivo:** `web/src/app/api/webhooks/abacatepay/route.ts`

1. Trocar `verifySignature` por `crypto.timingSafeEqual`:
   ```ts
   function verifySignature(payload: string, signature: string, secret: string): boolean {
     const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
     const a = Buffer.from(signature);
     const b = Buffer.from(expected);
     return a.length === b.length && crypto.timingSafeEqual(a, b);
   }
   ```
2. Tornar obrigatória:
   ```ts
   if (!secret) { ...; return apiError("Webhook não configurado", 500); }
   if (!signature) { ...; return apiError("Missing signature", 401); }
   if (!verifySignature(rawBody, signature, secret)) {
     return apiError("Invalid signature", 401);
   }
   ```

### Verificação
- `curl -X POST http://localhost:3000/api/webhooks/abacatepay` → 401.
- Assinatura errada → 401 (antes passava).

---

## 5. U5 — "Desvincular" sem confirmação no app móvel

### Por que mudar
- `hivenode-app/src/app/index.tsx:361-368` executa logout direto sem `Alert.alert`.
- Usuário toca sem querer → perde sessão → precisa re-escanear QR.
- UX doloroso, suporte reclama.

### Melhoria esperada
- -90% de "droga, sem querer".
- Conformidade com padrão iOS/Android (destructive actions pedem confirmação).

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/src/app/index.tsx` (e equivalente em `hiveminer-app/src/app/index.tsx`)

Substituir handler `handleLogout` (linha 361) por:

```tsx
const handleLogout = async () => {
  Alert.alert(
    "Desvincular Aparelho",
    "Isso desconecta o aparelho do painel. Você precisará escanear o QR Code novamente.",
    [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desvincular",
        style: "destructive",
        onPress: async () => {
          intentionalLogout.current = true;
          if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
          if (ws.current) ws.current.close();
          try { if (notifee) await notifee.stopForegroundService(); } catch (e) {}
          await AsyncStorage.clear();
          setNodeId("");
        }
      }
    ]
  );
};
```

### Verificação
- Tocar "Desvincular" abre modal com "Cancelar" e "Desvincular".
- Cancelar não desconecta.

---

## 6. E8 — Sem `HEALTHCHECK` nos Dockerfiles

### Por que mudar
- `broker/Dockerfile` e `web/Dockerfile` não têm `HEALTHCHECK`.
- Docker/Coolify/K8s não sabem quando o serviço ficou unhealthy.
- Traefik roteia p/ pods travados.

### Melhoria esperada
- Traefik retira rotas ruins automaticamente.
- Coolify reinicia pods travados.
- Dashboard mostra status real do serviço.

### Passos e arquivos a editar

**Arquivo:** `broker/Dockerfile`

Antes de `USER broker`, adicionar:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:10001/health || exit 1
```

(Precisa de `wget` na Alpine. Adicionar `RUN apk --no-cache add wget ca-certificates` perto do `ca-certificates` atual.)

**Arquivo:** `web/Dockerfile`

Antes de `USER nextjs`, adicionar:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
```

(Adicionar `RUN apk --no-cache add wget` no stage runner.)

### Verificação
- `docker inspect hivenode-web | grep Health` → healthy/unhealthy status.

---

## Resumo Sprint 1

| Item | Arquivo principal | Teste de sucesso |
|---|---|---|
| B1 middleware cookie | `web/src/middleware.ts` | `/miner` sem cookie → 307 |
| B2 Redis singleton | `web/src/app/api/proxies/route.ts` | CLIENT LIST sem growth |
| B3 JSON marshal | `broker/cmd/broker/main.go` | `go vet` limpo |
| S8 HMAC obrigatório | `web/src/app/api/webhooks/abacatepay/route.ts` | POST sem sig → 401 |
| U5 confirmar logout | `hivenode-app/src/app/index.tsx` | Alert cancela ação |
| E8 HEALTHCHECK | `broker/Dockerfile`, `web/Dockerfile` | `docker inspect` healthy |
