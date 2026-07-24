# P3 — Performance & Polish

> Faixa: 1-2 dias. Items que reduzem bundle, lag UI e arrumam drifts de build.
> Objetivo: Apps rodam 60fps mesmo sob tráfego alto; bundle APK menor; splash/build consistente p/ publish.

---

## 1. P-1 — Logs re-renderizam `setState` a cada log (UI lag em tráfego alto)

### Por que mudar
- `hivenode-app/src/app/index.tsx:385`: `setLogs((prev) => [{...}, ...prev].slice(0, 100))` em cada `addLog`.
- Em HiveMiner público com tráfego intenso, 30+ logs/s → 30 `setState`/s → React re-renderiza lista inteira (100 itens).
- Em Android médio (Redmi 8, Galaxy A12) trava a UI; usuário desinstala achando bug.
- Usuário BYOD privativo tem menos tráfego mas HiveMiner público é onde dói mais.

### Melhoria esperada
- 1 re-render/s via debounce, ainda assim mantém todos os logs em memória.
- Lista virtualizada (`FlashList` de `@shopify/flash-list`).
- 60fps em Android fraco mesmo com 50 logs/s.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/package.json`

Adicionar:
```json
"@shopify/flash-list": "1.7.3"
```

Mesmo p/ `hiveminer-app/package.json`.

**Arquivo:** `hivenode-app/src/app/index.tsx`

Importar:
```ts
import { FlashList } from "@shopify/flash-list";
```

Atualizar estado de logs e debounce:

```ts
const [logs, setLogs] = useState<{timestamp: Date, msg: string}[]>([]);
const logBufferRef = useRef<{timestamp: Date, msg: string}[]>([]);
const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

// Setup flushing de 1/s
useEffect(() => {
  flushTimerRef.current = setInterval(() => {
    if (logBufferRef.current.length > 0) {
      const newLogs = [...logBufferRef.current];
      logBufferRef.current = [];
      setLogs((prev) => [...newLogs.reverse(), ...prev].slice(0, 100));
    }
  }, 1000);
  return () => { if (flushTimerRef.current) clearInterval(flushTimerRef.current); };
}, []);

const addLog = (msg: string) => {
  logBufferRef.current.push({ timestamp: new Date(), msg });
  if (logBufferRef.current.length > 100) logBufferRef.current.shift();
  
  // ainda assim envia LOG p/ broker imediato (sem debounce)
  if (ws.current && ws.current.readyState === 1) {
    ws.current.send(JSON.stringify({ type: "LOG", payload: msg }));
  }
};
```

Substituir `<ScrollView> {logs.map(...)}</ScrollView>` por:

```tsx
<FlashList
  data={logs}
  renderItem={({ item, index }) => (
    <Text style={styles.logLine}>
      <Text style={styles.logTime}>{formatLogDate(item.timestamp)} </Text>
      {item.msg}
    </Text>
  )}
  estimatedItemSize={20}
  keyExtractor={(item, i) => `${item.timestamp.getTime()}-${i}`}
  inverted={false}
/>
```

Mesmo em `hiveminer-app/src/app/index.tsx`.

### Verificação
- Stress test que gera 50 logs/s → Profile `react-devtools` → Frame drops 60→confirmar 60fps constante.
- CPU do Android (Profiler) → menos picos de JS thread.

---

## 2. P-4 — `crypto-js` inteiro para uma operação HMAC

### Por que mudar
- `hivenode-app/src/app/index.tsx:16`: `import CryptoJS from "crypto-js"`.
- crypto-js é ~30KB minified, puxa três módulos de AES, RSA, MD5, encoders...
- Apps só usam `CryptoJS.HmacSHA256` (em `getWsUrl`).
- Bundle APK aumenta unnecessarily.

### Melhoria esperada
- Substituir por `expo-crypto` (native base) ou `react-native-hmac` (ligero).
- Bundle APK -25KB.
- Latência HMAC +rápida (crypto nativo C++ vs JS).

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/package.json`

Trocar:
```json
// removido: "crypto-js": "^4.2.0",
// add:
"expo-crypto": "~14.0.10"
```

**Arquivo:** `hivenode-app/src/app/index.tsx`

```ts
import * as Crypto from 'expo-crypto';

// Substituir getWsUrl:
const getWsUrl = async (address: string, nodeId: string, secret: string) => {
  const isProd = address.includes("alfastage.com.br");
  const hmacSig = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${nodeId}:${secret}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const proto = isProd ? "wss" : "ws";
  return `${proto}://${address}/tunnel?nodeId=${nodeId}&sig=${hmacSig}`;
};
```

**Atenção:** `getWsUrl` vira async; todos callers precisam `await`:

```ts
const wsUrl = await getWsUrl(serverIp, nodeId, tunnelSecret); // pós-S3
```

Em `connectToBroker`:

```ts
const connectToBroker = async () => {
  // ...
  const wsUrl = await getWsUrl(serverIp, nodeId, secret);
  ws.current = new WebSocket(wsUrl);
  // ...
};
```

Mesma troca em `hiveminer-app`.

### Verificação
- `npm uninstall crypto-js` • build APK size delta: -20 a -30KB.
- HMAC signature ainda aceita pelo broker.

---

## 3. P-6 — HiveDocker polling status a cada 2s em `/api/status`

### Por que mudar
- `hivedocker/public/index.html:131`: `setInterval(fetchStatus, 2000)`.
- Em homelab com 50 nodes HiveDocker abertos → 25 RPS p/ o Express de cada.
- Logs (`logs.slice(0, 20)`) trafegam em Polling HTTP mesmo sem mudança.

### Melhoria esperada
- WebSocket do painel p/ o Express (`/ws`) que faz push só quando logs mudam.
- 1 connection idle em vez de 25 RPS.

### Passos e arquivos a editar

**Arquivo:** `hivedocker/server.js`

Adicionar WebSocket no express:

```js
const wss = new WebSocket.Server({ server: app.listen(8080, '0.0.0.0') });

wss.on('connection', (client) => {
  // Envia estado inicial
  client.send(JSON.stringify({ type: 'status', data: getStatusData() }));
});

// Quando addLog ou isConnected muda, broadcast p/ todos:
function broadcastUpdate() {
  const payload = JSON.stringify({ type: 'status', data: getStatusData() });
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(payload);
  });
}

// Hook em addLog:
function addLog(msg) {
  // ... existente (inclui ws do broker)
  broadcastUpdate();
}

// Hook em startTunnel/stopTunnel:
// também chamam broadcastUpdate();

function getStatusData() {
  return {
    nodeId: config.nodeId,
    nodeName: config.nodeName,
    isConnected,
    uptime: tunnelStartTime ? Math.floor((Date.now() - tunnelStartTime) / 1000) : 0,
    logs: logs.slice(0, 20)
  };
}
```

**Arquivo:** `hivedocker/public/index.html`

Substituir polling por WS:

```js
let panelWs = null;
let panelToken = localStorage.getItem('hivedocker_panel_token');

function connectPanelWs() {
  panelWs = new WebSocket(`ws://${window.location.host}/ws?token=${panelToken}`);
  panelWs.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'status') {
      state.nodeId = msg.data.nodeId;
      state.nodeName = msg.data.nodeName;
      state.isConnected = msg.data.isConnected;
      state.logs = msg.data.logs;
      render();
    }
  };
  panelWs.onclose = () => setTimeout(connectPanelWs, 3000);
}
connectPanelWs();

// Manter fetchStatus só p/ estado inicial no reload manual (optional).
```

### Verificação
- 50 painéis abertos, todos idle → 50 conexões WS, 0 RPS.
- 1 novo log → broadcast instantaneous p/ todos painéis.

---

## 4. CB-2 — `hivenode-app` sem bloco `splash` explícito em `app.json`

### Por que mudar
- `hivenode-app/app.json` não tem bloco `splash` (depreciado em SDK 50+, mas exibido por fallback p/ `expo-splash-screen` plugin).
- `hiveminer-app/app.json:53-57` tem:
  ```json
  "splash": { "image": "...", "resizeMode": "contain", "backgroundColor": "#10b981" }
  ```
- Drift visual; em algum Android/Android TV result pode ter background branco.

### Melhoria esperada
- Splash consistente entre apps (mesmo código de initial display).
- Slack de drag-and-launch mais profissional.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/app.json`

Adicionar após bloco `android`:
```json
"splash": {
  "image": "./assets/images/splash-icon.png",
  "resizeMode": "contain",
  "backgroundColor": "#f59e0b"
}
```

### Verificação
- `eas build` → splash em cold start aparece com cor da marca.

---

## 5. CB-4 — `hivedocker/package.json` sem `engines` p/ Node 16+

### Por que mudar
- Sem `engines` field, npm não barr a instalação em Node 16/17.
- HiveDocker usa `crypto.randomUUID` (Node 14.17+) e `structuredClone` (Node 17+).
- Em homelab com Docker baseado em Node 16, app pode quebrar silenciosamente.

### Melhoria esperada
- TS warning e NPM instalar erro em Node antigo.
- Build determinístico.

### Passos e arquivos a editar

**Arquivo:** `hivedocker/package.json`

```json
{
  "name": "hivedocker",
  "version": "1.0.0",
  "description": "HiveNode Docker Client",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.18.2", "ws": "^8.16.0", "crypto-js": "^4.2.0" },
  "engines": { "node": ">=20.0.0" }
}
```

Também mover `Dockerfile` de `node:18-alpine` para `node:22-alpine` p/ alinhar com web/Dockerfile:

**Arquivo:** `hivedocker/Dockerfile`
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server.js ./
COPY public ./public
EXPOSE 8080
CMD ["npm", "start"]
```

### Verificação
- `npm install` em Node 16 → warning "Unsupported engine".
- Docker build usa `node:22-alpine`, alinhado com `web/Dockerfile`.

---

## 6. CB-5 — Apps (`hivenode-app`, `hiveminer-app`) não sincronizam lockfiles

### Por que mudar
- `hivenode-app/package.json` e `hiveminer-app/package.json` têm **mesmas versões de deps**.
- Cada um tem seu próprio `package-lock.json`. SI patches CVEs aplicados num, não propagam p/ o outro.
- Manutenção duplicada.

### Melhoria esperada
- Migrar p/ monorepo npm workspaces single lockfile OU pelo menos `syncpack` drift-check.

### Passos e arquivos a editar

#### Opção A: Monorepo npm workspaces (recomendado p/ longo prazo)

Criar `apps-monorepo/package.json` (fora do escopo agora por mudança grande):
```json
{
  "name": "hiveapps",
  "private": true,
  "workspaces": ["hivenode-app", "hiveminer-app"],
  "scripts": {
    "hivenode": "npm -w hivenode-app start",
    "hiveminer": "npm -w hiveminer-app start"
  }
}
```

#### Opção B: syncpack check (rapido, requisitos satisfaz)

Instalar syncpack dev:
```bash
npm install -D syncpack
```

Criar `.syncpackrc` em cada app:
```json
{
  "versionGroups": [{ "dependencies": ["@notifee/react-native"], "pinVersion": "9.1.8" }],
  "semverGroups": [{ "range": "^", "dependencies": ["expo-*", "react-native-*"] }]
}
```

CI: rodar `npx syncpack check` em ambos apps no pre-merge p/ garantir drift.

### Verificação
- `npx syncpack check` returns 0 exit code em ambos apps.
- Patch CVE em `hivenode-app` propagado — 1 commit, syncpack alerta o outro.

---

## 7. CB-6 — Drift entre `eas.json` profiles (não vistos em profundidade)

### Por que mudar
- `hivenode-app/eas.json` e `hiveminer-app/eas.json` têm profiles de build (dev, preview, production). Não li o conteúdo.
- Drift aqui significa publish p/ Google Play pode ter keystore errado ou channel errado p/ um app vs outro.

### Passos

**Revisar manualmente:**
- `eas.json` em cada app — profiles ok.
- `eas.json: ci.profileName` referencia o profile EAS do `app.json` → confirmação necessária.

### Verificação
- `eas build --profile preview --platform android` funciona em ambas sem ajuste individual.

---

## 8. D9 — `hiveminer-app/app.json` tem `owner: "thejaovitor"`, hivenode-app não tem

### Por que mudar
- `hiveminer-app/app.json:68`: `"owner": "thejaovitor"`.
- `hivenode-app/app.json` não tem `owner`.
- Em publicações Expo EAS, owner mismatch entre apps pode falhar `eas update` p/ channels errados.

### Melhoria esperada
- Owner consistente entre apps (caso pertençam à mesma org Expo).

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/app.json`

Adicionar no bloco `expo`:
```json
"owner": "thejaovitor"
```

Ou (melhor p/ longo prazo) criar EAS organization e trocar em ambos:
```json
"owner": "alfastage"
```

### Verificação
- `eas whoami` → ambos apps em mesmo owner.
- `eas update` sem erro de ownership.

---

## 9. P-7 — Apps iOS Battery Botão inútil (exclusivo Android)

### Por que mudar
- `hivenode-app/src/app/index.tsx:770-779`: botão bateria chama `IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATIONS_SETTINGS` que só existe em Android.
- iOS mostra Alert "exclusiva p/ Android" → frustra usuário iOS que clicou.

### Melhoria esperada
- Botão só aparece em Android.
- iOS mostra outra ação útil (notificação donc not perturbar) ou simplesmente oculto.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/src/app/index.tsx` e `hiveminer-app` (com botão bateria novo do P0 §3)

```tsx
{Platform.OS === 'android' && (
  <TouchableOpacity
    onPress={() => IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATIONS_SETTINGS)}
    style={/*...*/}
  >
    <Ionicons name="battery-charging-outline" size={20} color="#f59e0b" />
  </TouchableOpacity>
)}
```

Ou iOS usa `expo-battery` p/ mostrar nível de bateria atual em vez de botão (info util).

### Verificação
- iOS Simulator: botão não aparece no header.
- Android Emulator: botão aparece e funciona.

---

## Resumo P3

| Item | Arquivos | Resultado |
|---|---|---|
| P-1 FlashList + debounce logs | apps `package.json`, `index.tsx` | 60fps sob tráfego alto |
| P-4 expo-crypto sem crypto-js | apps `package.json`, `index.tsx` | -30KB APK |
| P-6 HiveDocker WS p/ painel | `hivedocker/server.js`, `public/index.html` | 25 RPS p/ 0 idle |
| CB-2 splash block | `hivenode-app/app.json` | Splash consistente |
| CB-4 engines node>=20 | `hivedocker/package.json`, `Dockerfile` | Build determinístico |
| CB-5 syncpack drift apps | apps apps | CVE patches propagam |
| CB-6 eas.json sync | revisão manual | Publish consistente |
| D9 owner Expo EAS | `hivenode-app/app.json` | 1 owner ambos apps |
| P-7 Botão bateria só Android | apps `index.tsx` | UX iOS sem alerta desnecessário |

---

# 📋 Ordem de Execução Completa

A ordem recomendada que respeita dependências entre sprints:

1. **P0** — Fluxos Queenbrados (HiveDocker OAuth, HiveMiner PUB nó, Play Store perms).
2. **P1** — HiveDocker segurança/resiliência (sem loop KICKED, SIGTERM, LOG p/ broker).
3. **P2** — Crypto/HMAC (SecureStore, HMAC por usuário, host validation).
4. **P3** — Performance/publish hygiene.

Após todos os 4 sprints:
- HiveDocker é um nó de primeira classe (não fantasma).
- Apps móveis sem drift de copy-paste.
- Painel do Next.js vê telemetria e logs de todos os 3 clientes em tempo real.
- Play Store aceite releases sem warnings de permissions sensíveis.
- Bundle APK mais leve (-70KB combinado).
- Android并不意味着 morte BG.

Os 4 arquivos completos em `.explicações/melhorias-apps-glm-5.2/`:
- `01-p0-fluxos-quebrados.md`
- `02-p1-hivedocker-seguranca.md`
- `03-p2-confiabilidade-crypto.md`
- `04-p3-performance-polish.md`

Após cada sprint: rodar `npm run lint` e `npx expo doctor` nos apps, `go test ./...` no broker, `docker compose up web broker` p/ verificar startup sem regressão.
