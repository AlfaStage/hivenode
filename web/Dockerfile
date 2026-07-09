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
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV REDIS_URL="redis://localhost:6379/0"
ENV JWT_SECRET="build-time-dummy-secret"
ENV ENCRYPTION_KEY="build-time-dummy-encryption-key-32ch"
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"

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

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
