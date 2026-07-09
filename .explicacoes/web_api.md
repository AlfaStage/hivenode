# Next.js Web App & Banco de Dados

## Tecnologias Base
- Next.js 15 (App Router)
- Tailwind CSS v4 + Glassmorphism UX
- Prisma ORM 7 + PostgreSQL

## Estrutura de Rotas e Componentes
A aplicação usa Server Components nativos mesclados com Client Components (`"use client"`) onde interação é necessária.

### Rotas Principais (`src/app/`)
- `(auth)/login` e `(auth)/register`: Fluxo de autenticação isolado.
- `(dashboard)/`: Área restrita (`layout.tsx` protege com JWT).
  - `/nodes`: Gestão de proxies móveis e SOCKS5 bypass.
  - `/billing`: Assinaturas e integração de saldo com Abacate Pay.

### URLs / Endpoints (API)
- `POST /api/auth/register`: Recebe email/senha, gera hash bcrypt e salva no BD. Cria `ADMIN` se o domínio for `@alfastage.com.br`.
- `POST /api/auth/login`: Gera o JWT Token usando `jose`.
- `GET /api/nodes`: Lista de nodes autenticada via JWT.
- `POST /api/nodes/[id]/regenerate`: Recria os dados do SOCKS5 (proxyUser, proxyPass).
- `POST /api/webhooks/abacatepay`: Escuta eventos `payment.success` (Assinatura digital HMAC HMAC256) e recarrega os gigabytes no BD.

## Gerenciamento de Estado de Tráfego (Workers)
O serviço Next.js não apenas serve páginas, ele processa dados em plano de fundo:
- Arquivo: `src/lib/worker.ts`
- O `BullMQ` se conecta ao Redis local e consome a fila de bytes trafegados vindos do Broker Go.
- Quando o saldo de bytes zera, ele atualiza o Banco de Dados para `BLOCKED` e suspende os nós.
