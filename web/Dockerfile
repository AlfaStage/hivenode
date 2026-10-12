FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
ENV DATABASE_URL=postgresql://build:build@localhost/build
ENV REDIS_URL=redis://localhost:6379
ENV JWT_SECRET=build-only-secret-not-used-at-runtime-12345
ENV ENCRYPTION_KEY=build-only-key-not-used-at-runtime-12345678
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run typecheck
RUN npx next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

FROM deps AS tools
COPY . .
ENV DATABASE_URL=postgresql://build:build@localhost/build
RUN npx prisma generate
USER node
CMD ["npm", "run", "worker"]
