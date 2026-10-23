# Project: HiveNode Ecosystem Diagnostic Technical Audit

## Architecture & Ecosystem Scope
The HiveNode ecosystem comprises 6 primary areas:
1. **Infrastructure & Root Orchestration**: `docker-compose.yml`, root scripts, Dockerfiles, environment files (`.env`, `.env.example`).
2. **Broker (`broker/`)**: High-performance Go-based network broker managing SOCKS5 proxying, WebSocket tunnels, node connections, telemetry, and rate/usage metering.
3. **Web (`web/`)**: Next.js 16 full-stack application with Prisma ORM, PostgreSQL database, authentication/RBAC, billing integration (AbacatePay), node/proxy dashboard, and admin APIs.
4. **HiveMiner App (`hiveminer-app/`)**: React Native / Expo mobile application managing background mining / network node execution on Android/iOS.
5. **HiveNode App (`hivenode-app/`)**: React Native / Expo desktop/mobile client for user node provisioning, network routing, and telemetry.
6. **HiveDocker (`hivedocker/`)**: Node.js Docker management daemon communicating via Docker socket to orchestrate worker containers.

## Feature Inventory & Defect Scope
Every identified issue from the Survey Phase is assigned to an audit milestone:

| # | Component | Defect / Focus Area | Severity | Milestone | Source |
|---|-----------|---------------------|----------|-----------|--------|
| 1 | Infra | Missing env vars causing `docker compose up` failure | Crítico | M1 | Survey 1 |
| 2 | Broker | Synchronous HTTP billing per 32KB chunk causing connection drops | Crítico | M1 | Survey 1 |
| 3 | Broker | Stream drop `default: s.close()` in WebSocket when buffer >1MB | Crítico | M1 | Survey 1 |
| 4 | Infra | Env port name mismatch (`SOCKS_PORT` vs `BROKER_SOCKS5_PORT`) | Alto | M1 | Survey 1 |
| 5 | Infra | 60s startup delay on broker due to web healthcheck condition | Alto | M1 | Survey 1 |
| 6 | Broker | SSRF bypass on hostname targets (`localhost`, local domains) | Alto | M1 | Survey 1 |
| 7 | Infra | Syntax errors and non-ASCII characters in `.env` / `.env.example` | Médio | M1 | Survey 1 |
| 8 | Infra | Inexistent root `package.json` referenced in `.syncpackrc` | Médio | M1 | Survey 1 |
| 9 | Infra | Hardcoded `GOARCH=amd64` in broker Dockerfile | Médio | M1 | Survey 1 |
| 10 | Broker | RFC 1928/1929 violations on offline nodes & abrupt socket close | Médio | M1 | Survey 1 |
| 11 | Broker | Synchronous head-of-line blocking in telemetry Broadcast | Médio | M1 | Survey 1 |
| 12 | Broker | Dashboard WebSocket disconnection every 10 min (no PongHandler) | Médio | M1 | Survey 1 |
| 13 | Broker | Missing SIGINT/SIGTERM handling leaving ghost nodes in Redis | Médio | M1 | Survey 1 |
| 14 | Broker | Device-level single mutex contention under 64 concurrent streams | Médio | M1 | Survey 1 |
| 15 | Infra | 54MB compiled binaries and error logs tracked in git repo | Baixo | M1 | Survey 1 |
| 16 | Broker | Dead code `ValidateSOCKS5User` in Redis client | Baixo | M1 | Survey 1 |
| 17 | Broker | Unchecked `panic(err)` in `uuid()` | Baixo | M1 | Survey 1 |
| 18 | Broker | Relative path `../../.env` failure if run outside `cmd/broker/` | Baixo | M1 | Survey 1 |
| 19 | Web | Inactive middleware `src/proxy.ts` ignored by Next.js | Crítico | M2 | Survey 2 |
| 20 | Web | Fatal crash in `POST /api/shares` using inexistent `z.email()` | Crítico | M2 | Survey 2 |
| 21 | Web | Null pointer crash in `/api/internal/usage` when `node.userId == null` | Crítico | M2 | Survey 2 |
| 22 | Web | Hardcoded HMAC secret in webhook and algorithm discrepancy | Crítico | M2 | Survey 2 |
| 23 | Web | Invalid `JWT_SECRET` (<32 chars) in `.env` failing min length | Crítico | M2 | Survey 2 |
| 24 | Web | Zod enum error with object in `admin/subscriptions/[id]` | Alto | M2 | Survey 2 |
| 25 | Web | Admin plans button sends unsupported action triggering 500 | Alto | M2 | Survey 2 |
| 26 | Web | 1MB max traffic batch ceiling dropping aggregated usage | Alto | M2 | Survey 2 |
| 27 | Web | Faulty `@prisma/adapter-pg` init with plain object instead of Pool | Alto | M2 | Survey 2 |
| 28 | Web | Cross-component relative path to `../../hivedocker/node_modules/ws` | Alto | M2 | Survey 2 |
| 29 | Web | HTTP 500 instead of 400/401 on expired/used reset token | Médio | M2 | Survey 2 |
| 30 | Web | Unhandled crash with HTTP 500 if `NEXT_PUBLIC_APP_URL` is undefined | Médio | M2 | Survey 2 |
| 31 | Web | Naive `setMonth` causing month-end rollover in billing subscription | Médio | M2 | Survey 2 |
| 32 | Web | HTTP 403 Forbidden instead of 400 on insufficient points | Médio | M2 | Survey 2 |
| 33 | Web | Manual subscription grant writes fictitious `planType: "FREE"` | Médio | M2 | Survey 2 |
| 34 | Web | Price discrepancy in Starter plan (R$49,90 vs R$29,90) & missing seed config | Médio | M2 | Survey 2 |
| 35 | Web | Silent decryption failure returning empty string | Médio | M2 | Survey 2 |
| 36 | Web | Orphaned/unimported admin components | Baixo | M2 | Survey 2 |
| 37 | Web | Empty orphaned directory `web/worker/` | Baixo | M2 | Survey 2 |
| 38 | Web | Empty migration file `20260909000000_initial/migration.sql` | Baixo | M2 | Survey 2 |
| 39 | Web | Permission forbidden converted to 500 in payment-key route | Baixo | M2 | Survey 2 |
| 40 | Apps | Compulsory kill on Android 14+ (Notifee plugin missing in app.json) | Crítico | M3 | Survey 3 |
| 41 | Apps | Missing `POST_NOTIFICATIONS` permission in Android 13+ | Alto | M3 | Survey 3 |
| 42 | Apps | Missing dependency `react-native-worklets` in hiveminer-app | Crítico | M3 | Survey 3 |
| 43 | Apps | Missing `forceLogout()` on `KICKED` revocation in mobile client | Alto | M3 | Survey 3 |
| 44 | Apps | Race condition between `CLOSE` and pending `DIAL` connection | Alto | M3 | Survey 3 |
| 45 | Apps | Missing network backpressure with severe OOM crash risk | Crítico | M3 | Survey 3 |
| 46 | Apps | Potential TCP payload corruption with `charCodeAt()` fallback | Médio | M3 | Survey 3 |
| 47 | Apps | `harden-tcp.cjs` postinstall script ignores iOS native client | Alto | M3 | Survey 3 |
| 48 | Apps | Unused dependency `crypto-js` in hivedocker | Médio | M3 | Survey 3 |
| 49 | Apps | Orphaned scripts (`unescape.js`) and heavy build dumps in tree | Baixo | M3 | Survey 3 |
| 50 | Cross | Dockerized TypeCheck & Prisma Schema Validation Diagnostics | Crítico/Alto | M4 | Docker |
| 51 | Cross | Full Consolidated Deliverable `auditoria-erros.md` Synthesis | N/A | M5 | Synthesis |
| 52 | Cross | Forensic Integrity & Cleanliness Gate Check | N/A | M6 | Auditor |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Infra & Broker Audit Consolidation | Static & architectural audit of docker-compose, Dockerfiles, scripts, env, and broker/ | Survey | DONE |
| M2 | Web & DB Audit Consolidation | Static & architectural audit of Next.js, Prisma, APIs, RBAC, Auth, Frontend | Survey | DONE |
| M3 | Client Apps Audit Consolidation | Static & architectural audit of hiveminer-app, hivenode-app, and hivedocker | Survey | DONE |
| M4 | Docker Isolated Diagnostics | Run Dockerized compiler/typecheck/lint diagnostics on web and broker inside Docker containers | M1, M2, M3 | DONE |
| M5 | Consolidated Report Generation | Produce `c:\Users\theja\HiveNode\.documentação\auditoria-erros.md` | M1, M2, M3, M4 | DONE |
| M6 | Forensic Integrity & Cleanliness Gate | Verify `auditoria-erros.md`, audit zero false positives, verify `git status --porcelain` is clean | M5 | DONE |

## Interface Contracts & Guidelines
- Strict Read-Only on Project Code: No modification of any tracked code/config files in `web/`, `broker/`, apps, or root.
- All dynamic diagnostic validations (typechecks, Prisma validation, etc.) must be executed inside ephemeral Docker containers without polluting host or leaving dangling processes.
- Final output format: `c:\Users\theja\HiveNode\.documentação\auditoria-erros.md` with:
  1. Sumário Executivo Quantitativo (Erros por Severidade e por Componente).
  2. Seções dedicadas: Docker Compose / Infra, Web, Broker, HiveMiner App, HiveNode App, HiveDocker.
  3. Formato padronizado de erro: ID, Severidade, Componente, Arquivo e Linha(s), Causa Raiz, Evidência Objetiva, Impacto no Sistema.
