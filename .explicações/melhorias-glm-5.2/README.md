# HiveNode — Plano de Melhorias (GLM-5.2 Review)

> Análise técnica do sistema HiveNode mantendo a **mesma visão de negócio** e **mesmas funcionalidades**.
> Ênfase em: **velocidade**, **segurança**, **usabilidade** e **escalabilidade**.
> Não há mudança de stack nem de fluxo de usuário final — apenas de implementação.

## Documentos de sprint

| Sprint | Foco | Itens | Tempo estimado |
|---|---|---|---|
| 1 | Quick Wins | [01-sprint-quick-wins.md](./01-sprint-quick-wins.md) | 1-3 dias |
| 2 | Performance Bruta | [02-sprint-performance-bruta.md](./02-sprint-performance-bruta.md) | 3-7 dias |
| 3 | Segurança Crítica | [03-sprint-seguranca-critica.md](./03-sprint-seguranca-critica.md) | 3-6 dias |
| 4 | UX + Billing | [04-sprint-ux-billing.md](./04-sprint-ux-billing.md) | 3-5 dias |

## Princípios aplicados

1. **Não alterar comportamento visível ao usuário** — só como é implementado.
2. **Cada item auto-contido** — pode ser aplicado e testado isoladamente.
3. **Compatibilidade com Deploy** — todos itens rodam com `docker-compose up` atual; sem rebuild de infra.
4. **Rollback fácil** — migrations reversíveis, feature flags implícitas em endpoints novos.

## Notas de ordem recomendada

- **Sprint 1 primeiro** — alguns items (S8 healthcheck, B1 middleware) são pré-requisitos de segurança para Sprint 3.
- **Sprint 3 S1** (HMAC por usuário) deve rodar antes do **Sprint 4 U2** (autenticar com tunnelSecret novo).
- **Sprint 3 B7** (migrate deploy) deve rodar antes de qualquer alteração em `prisma/schema.prisma` dos outros sprints.

## Métricas-alvo pós-todos-sprints

| Métrica | Antes | Alvo |
|---|---|---|
| Latência `GET /api/nodes` (100 nós online) | ~300ms (HTTP fetch broker) | <20ms (Redis SISMEMBER) |
| Latência `POST /api/nodes` (5 planos) | ~400ms (6 queries) | <80ms (1 query) |
| Broker CPU @ 500Mbps | ~80% (GC contention) | ~30% (buffer pool + batch) |
| Webhook AbacatePay p99 | Não determinístico (race) | <50ms idempotente |
| APK reverse expose secrets | Sim (1 string) | Não (por usuário, via JWT) |
| Dump DB expose proxyPass | Plaintext | Bcrypt hash |
| Escala broker horizontal | Não (1 instância) | Sim (cookie sticky + Pub/Sub) |
| Dashboard RT latência status change | ~5s (polling) | <100ms (WS) |

## Arquivos devalidação global

- `broker/cmd/broker/main.go` — testes de unit p/ tunnel manager + race detection (`go test -race`).
- `web/src/lib/auth.test.ts` — existente, expandir p/ novo token.
- `web/src/app/api/webhooks/abacatepay/route.ts` — adicionar test e2e Playwright (já é devDep) p/ duplo webhook.
- `broker/internal/redis/client_test.go` — já existe teste de rate-limit; adicionar bench de ValidateSOCKS5User.

Após cada sprint: rode `npm run test` em `web/` e `go test ./...` em `broker/`. Inspecione logs do compose (`docker compose logs -f`) confirmando que nenhuma regressão de startup ocorreu.
