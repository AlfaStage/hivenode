# ==============================================================================
# HiveNode Web — Dockerfile (Multi-stage)
# ==============================================================================
# Stages:
#   - deps: Instala dependências Node.js
#   - dev: Ambiente de desenvolvimento com hot-reload
#   - builder: Compila o Next.js para produção (standalone)
#   - runner: Imagem final mínima para produção
# ==============================================================================

# --- Stage 1: Dependências ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Força instalação de TODAS as dependências (inclusive devDependencies)
# O Coolify injeta ARG NODE_ENV=production que faz npm pular devDependencies
ENV NODE_ENV=development
RUN npm install --ignore-scripts

# --- Stage 2: Desenvolvimento (usado pelo docker-compose) ---
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
CMD ["npm", "run", "dev"]

# --- Stage 3: Build de produção ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis dummy para o build não crashar ao importar Redis/Prisma
ENV REDIS_URL="redis://localhost:6379/0"
ENV JWT_SECRET="build-time-dummy-secret"
ENV ENCRYPTION_KEY="build-time-dummy-encryption-key-32ch"

# Argumentos que o Coolify/Docker vai passar durante o build
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Mock de DATABASE_URL para o prisma generate não quebrar durante o build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate
RUN npm run build

# --- Stage 4: Runner de produção ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# Segurança: roda como user não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia apenas o necessário do build standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Arquivos que o Prisma CLI precisa para resolver prisma.config.ts e DATABASE_URL
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Dependências do Prisma CLI (prisma, tsx, typescript) para rodar db push em runtime
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/typescript ./node_modules/typescript
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/.bin/tsx ./node_modules/.bin/tsx

# Script de inicialização: sincroniza schema no banco e depois inicia o servidor
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🔄 Sincronizando schema Prisma com o banco..."' >> /app/start.sh && \
    echo 'npx prisma db push --accept-data-loss --skip-generate 2>&1 || echo "⚠️ Prisma push falhou, continuando..."' >> /app/start.sh && \
    echo 'echo "🚀 Iniciando Next.js..."' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

USER nextjs
EXPOSE 3000
CMD ["/app/start.sh"]
