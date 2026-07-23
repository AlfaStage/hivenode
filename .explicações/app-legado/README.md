# HiveNode Legacy — App Android para Aparelhos Antigos (4.1+)

> **Objetivo:** criar um APK enxuto (~3-5 MB) que rode em **Android 4.1 (API 16) até Android 5.1 (API 22)**, cobrindo celulares antigos, TV Box baratas e Mini PCs. O app executa o mesmo trabalho do HiveNode/HiveMiner moderno (túnel reverso para o Broker Go) sem Travas no aparelho, sem React Native/Expo (que exigem Android 6+), sem JVM pesada.

## Por que outro app?

Os apps modernos (`hivenode-app` e `hiveminer-app`) usam **Expo 54 + React Native 0.81**, que exigem `minSdkVersion=23` (Android 6.0). Isto exclui:

- TV Box chinesas com Android 4.4 (imenso mercado de aparelhos reutilizados)
- Celulares Android 4.x (Galaxy S3, Moto G1, etc.) ainda em uso como nós secundários
- Mini PCs rk3xxx com Android 4.4/5.1 vendidos como "TV Box"

A ponta do túnel reverso, no entanto, é só I/O — não precisa de UI moderna. Dá pra fazer em **Go puro via gomobile** + **shell Java ultra-mínimo**, reutilizando a lógica do `broker/internal/tunnel/*` que já existe.

## Documentação

| Arquivo | O quê | Para quem |
|---|---|---|
| [01-arquitetura.md](./01-arquitetura.md) | Visão geral, diagrama, porquê das escolhas, limites | Dev sênior, LLM de alto nível |
| [02-setup-toolchain.md](./02-setup-toolchain.md) | Instalação de Go, Android SDK/NDK, JDK 8 — **via Docker**, sem sujar o PC | Dev de qualquer nível |
| [03-codigo-go.md](./03-codigo-go.md) | Código Go do núcleo do túnel + bind gomobile, com referências linha-a-linha ao `broker/` | Dev Go/Go-mobile |
| [04-codigo-android-java.md](./04-codigo-android-java.md) | Shell Java (Activity, Service, Receivers), layouts XML, Manifest | Dev Android |
| [05-fluxo-login.md](./05-fluxo-login.md) | 3 modos de login (email/senha, QR, código 6 chars) integrando com endpoints já existentes | Dev Android/Go |
| [06-build-apk-docker.md](./06-build-apk-docker.md) | Como gerar o APK assinado via docker sem instalar nada no PC | Qualquer um |
| [07-teste-deploy.md](./07-teste-deploy.md) | Como testar num emulador Android 4.4, sideload em TV Box real, update automático | QA |

## Pré-requisitos de conhecimento

- **Go básico** — ler `broker/` e entender `goroutine`, `context`, `net.Conn` é suficiente.
- **Java/Android básico** — Activity, Service, Manifest. Sem frameworks modernos.
- **HTTP/WebSocket** — saber chamar endpoints e persistir um token em `SharedPreferences`.
- **Docker** — só `docker build` e `docker run`.

## Compatibilidade confirmada

| Componente existente | Compatível com Legado? | Como |
|---|---|---|
| `broker/internal/tunnel/websocket.go` | ✅ | Protocolo WS idêntico — Legado é indistinguível do moderno no painel |
| `web/src/app/api/auth/login` | ✅ | POST JSON `{email, password}` → `{token, user}` |
| `web/src/app/api/auth/device-code/generate` + `/poll` + `/approve` | ✅ | Mesmo fluxo do CLI — 6 chars `AB3X9Y` |
| `web/src/app/api/auth/pair-code` (GET + POST) | ✅ | Código `HV-XXXX` validado em 10 min |
| `web/src/app/api/auth/qr-login` | ✅ | Troca `linkToken` por JWT |
| Redis, Prisma, Abacate Pay | ✅ | Legado nunca toca diretamente — passa pelo Broker/Web |
| `hivedocker/server.js` | ✅ | Referência de implementação idêntica ao que o Legado fará em Go |

## ⚠️ Pendência de segurança — dependência do Sprint 3 S1

O broker atual usa `hivenode_secret_key` hardcoded em `broker/internal/tunnel/websocket.go:215`. O app Legado nascerá usando o mesmo segredo (igual `hivedocker/server.js:48` faz). Quando **você aplicar Sprint 3 S1** de `.explicações/melhorias-glm-5.2/03-sprint-seguranca-critica.md` (trocar para `tunnelSecret` por usuário), o app Legado também precisará:

1. Receber `tunnelSecret` do JWT retornado por `/login`, `/qr-login`, `/pair-code`, `/device-code/poll`.
2. Guardar em `SharedPreferences`.
3. Passar para o bind Go para assinar HMAC do WS.

** Detalhes completos em `05-fluxo-login.md` seção "Migração Sprint 3 S1".**

---

## TL;DR para uma LLM executar

```text
1. Ler 01-arquitetura.md para ENTENDER o sistema
2. Ler 02-setup-toolchain.md e RODAR docker pull da imagem hivenode/legacy-builder
3. Implementar 03-codigo-go.md (núcleo Go) e 04-codigo-android-java.md (shell)
4. Integrar 05-fluxo-login.md (3 modos de login)
5. Rodar 06-build-apk-docker.md para gerar hivenode-legacy.apk
6. Validar com 07-teste-deploy.md num emulador Android 4.4
```

Tamanho final esperado: APK ~3-5 MB, RAM idle ~15 MB, CPU <1% idle, suporta 100+ conexões simultâneas sem travar a TV Box.
