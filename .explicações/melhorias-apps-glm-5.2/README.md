# HiveNode Apps & HiveDocker — Plano de Melhorias (GLM-5.2 Review)

> Análise técnica dos 3 clientes HiveNode (`hivenode-app`, `hiveminer-app`, `hivedocker`) à luz do Broker Go e da API Next.js.
> Mesma visão de negócio, mesma funcionalidades — apenas correção de inconsistências, drifts e bugs.

## Documentos de sprint

| Sprint | Foco | Itens | Tempo |
|---|---|---|---|
| P0 | Fluxos Quebrados & Compliance | [01-p0-fluxos-quebrados.md](./01-p0-fluxos-quebrados.md) | 2-4 dias |
| P1 | HiveDocker Segurança & Resiliência | [02-p1-hivedocker-seguranca.md](./02-p1-hivedocker-seguranca.md) | 2-3 dias |
| P2 | Confiabilidade & Crypto nos Apps | [03-p2-confiabilidade-crypto.md](./03-p2-confiabilidade-crypto.md) | 2-3 dias |
| P3 | Performance & Polish | [04-p3-performance-polish.md](./04-p3-performance-polish.md) | 1-2 dias |

## Resumo dos problemas encontrados

### 🔴 P0 — Fluxos quebrados (rompem funcionamento)
- **HiveDocker** nunca chama `POST /api/nodes` → cria nodeId fake `DOCKER-XXXX` que não existe no Postgres. Nó fantasma no Broker, sem dono, sem contabilidade.
- **HiveDocker** guarda `linkToken` (5min) mas nunca troca por JWT de sessão via `/api/auth/qr-login`.
- Painel Next.js **não tem tela de aprovação** de device-code apesar do endpoint existir.
- **HiveMiner** no login manual envia `deviceName: "HiveNode Android"` e esquece `visibility: "PUBLIC"` → cria nó PRIVATE.
- **HiveMiner** não tem botão de otimização de bateria (Android mata em BG).
- Apps declaram `android.permission.RECORD_AUDIO` sem funcionalidade → Google Play rejeita.
- Apps não tratam 403 "sem plano" no onboarding → usuário fica preso.
- Apps e HiveDocker fazem fallback p/ porta 80 sem validar host (risco SSRF).

### 🟠 P1 — HiveDocker segurança/resiliência
- Painel HiveDocker exposto sem auth (`/api/tunnel/stop` qualquer um derruba).
- HiveDocker não respeita `reason="KICKED"` do broker → reconecta em loop infinito.
- HiveDocker sem reconexão exponencial (broker cai → node offline p/ sempre até manual).
- HiveDocker sem SIGTERM handler (Docker stop corta sockets abruptamente).
- Apps têm 3 strings de versão diferentes (1.0.2, 1.0.0, package 1.1.0).
- HiveDocker não envia LOG/TELEMETRY → dashboard fica "cego" p/ Docker nodes.
- Apps chamam `api.ipify.org` a cada 10s (consome dados do BYOD).
- HiveDocker sem `.dockerignore` → build copia `config.json` com tokens.

### 🟡 P2 — Confiabilidade & Crypto
- Apps guardam JWT em `AsyncStorage` (legível em Android root/ADB backup).
- `getApiUrl` dos apps usa `includes("alfastage.com.br")` (DNS hijack via substring).
- Segredo HMAC `"hivenode_secret_key"` hardcoded em todos os 3 apps (reforço do plano anterior).
- Drifts finos entre hivenode-app e hiveminer-app (deviceName inconsistente, função morta rename, sem email no header miner).
- HiveDocker não aplica `NODE_RENAMED` → painel local mostra nome velho p/ sempre.
- Nenhum cliente envia heartbeat WS (dead connection detected em 2h vs <45s).
- Apps têm 47 linhas de `encodeBase64`/`decodeBase64` mortas.

### 🟢 P3 — Performance & Polish
- `setLogs` a cada log → 30 re-renders/s em tráfego alto (UI trava em Android fraco).
- `crypto-js` (30KB) p/ uma operação HMAC (poderia ser `expo-crypto` nativo).
- HiveDocker `setInterval` polling `/api/status` a cada 2s (25 RPS em 50 nodes).
- Splash block ausente em `hivenode-app/app.json`.
- `hivedocker/package.json` sem `engines` (pode quebrar em Node antigo).
- `hivenode-app/package-lock.json` e `hiveminer-app` divergentes (CVE não propaga).
- `owner` do Expo EAS divergente entre os apps.

## Ordem de execução

1. **P0 primeiro** — alguns items (P0 §1 HiveDocker OAuth) desbloqueiam o P1 (tokenizer não pode persistir sem OAuth completo; P1 § B-drift-2 KICKED precisa do fluxo real rodando).
2. **P1** — HiveDocker pode funcionar em produção após isto, sem preceder P0.
3. **P2** — Crypto/HMAC exige integração com Sprint 3 do plano `melhorias-glm-5.2` (HMAC por usuário).
4. **P3** — Polish e bundle hygiene.

## Métricas-alvo pós-todos-sprints

| Métrica | Antes | Alvo |
|---|---|---|
| HiveDocker aparece no painel do dono | Não (nó fantasma) | Sim (nó legítimo) |
| HiveMiner tempo de uptime médio | ~3-5 min (Android Doze) | 8h+ (battery whitelist) |
| Play Store accept release | Não (RECORD_AUDIO) | Sim |
| Onboarding sem plano converte | 0% (abandono) | >30% (webview billing) |
| Detecção de WS morto (heartbeat) | ~2h | <45s |
| Bundle APK | ~30KB crypto-js + 47 linhas mortas | -70KB combinado |
| RPS HiveDocker painel idle | 25 RPS p/ 50 nodes | 0 (WebSocket) |
| Apps expõem JWT em backup | Sim (AsyncStorage) | Não (SecureStore) |
| HiveDocker painel exposto público | Sem auth | Com token Bearer |

## Arquivos de validação por sprint

- **P0:** `eas build --profile preview` sem warning de permissions. Painel `/dashboard/admin/device-approve` funcional. Logs do HiveDocker mostram `post /api/nodes` com 201.
- **P1:** `docker stop hivedocker` → graceful shutdown <3s. `docker compose restart broker` → HiveDocker reconecta em <1 min. `curl http://hivedocker:8080/api/tunnel/stop` sem token → 401.
- **P2:** `adb backup` em device Android não extrai tokens. `grep hivenode_secret_key` em todos apps → 0 ocorrências.
- **P3:** `npx expo-bundle-analyzer` em build production → -70KB vs antes. HiveDocker status dashboard mostra 0 RPS idle.

## Princípios aplicados

1. **Zero mudança de UX do usuário final** — a única mudança visível é fluxo HiveDocker (novo onboarding OAuth), restantes são estabilidade.
2. **Dependências explícitas** — items referenciam sprints do `melhorias-glm-5.2/` quando compartilham fix (C4 em P2 é cross-ref p/ P0 §6).
3. **Compatibilidade Docker** — todos items rodam com `docker-compose up` atual sem rebuild de infra (exceto troca de imagem Node 18→22 do HiveDocker, configurable).
4. **Rollback trivial** — cada item é independente; reverter um não quebra o strides dos outros.

Após cada sprint: `npm run lint` + `npx expo doctor` nos apps, `go test ./...` no broker, `docker compose up hivedocker` p/ verificar startup sem regressão.
