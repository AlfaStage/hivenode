# P1 — Segurança & Resiliência do HiveDocker

> Faixa: 2-3 dias. Itens que evitam loops, DoS e variação por ambiente.
> Objetivo: HiveDocker sobrevive a restart do Broker sem loop; painel Docker não é exposto publicamente; apps convergem p/ versão única; taille do plano chega corretamente.

---

## 1. S2 — HiveDocker painel local sem auth

### Por que mudar
- `hivedocker/server.js:145-209` expõe rotas `/api/tunnel/{start,stop}`, `/api/auth/start`, `/api/auth/poll`, `/api/logout` **sem qualquer auth**.
- `hivedocker/README.md:53` incentiva expor porta 8080 publicamente via Coolify ("Configure a porta 8080 no Coolify p/ ser exposta ao público ou a um domínio customizado").
- Qualquer pessoa que descubra o domínio pode:
  - Derrubar o túnel (`POST /api/tunnel/stop`).
  - Desvincular o node (`POST /api/logout`).
  - Poluir logs p/ esconder tráfego.
- Em homelab (rede local) é risco menor, mas HiveDocker é promovido p/ VPS via Coolify → risco é real.

### Melhoria esperada
- Painel HiveDocker gera `panelToken` no `config.json` e exige `Authorization: Bearer panelToken` em todas rotas `/api/*`.
- `index.html` pede token no primeiro acesso e guarda em localStorage.
- `HIVEDOCKER_PUBLIC=true` permite bypass p/ dev local.

### Passos e arquivos a editar

**Arquivo:** `hivedocker/server.js`

Adicionar após `const saveConfig` (linha 23):

```js
const crypto = require('crypto');

function ensurePanelToken() {
  if (!config.panelToken) {
    config.panelToken = crypto.randomBytes(24).toString('hex');
    saveConfig();
    addLog(`🔑 Novo token de painel gerado: ${config.panelToken.slice(0, 8)}...`);
  }
}
ensurePanelToken();

function requireToken(req, res, next) {
  if (process.env.HIVEDOCKER_PUBLIC === 'true') return next();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== config.panelToken) {
    return res.status(401).json({ error: 'Acesso não autorizado' });
  }
  next();
}

// Aplicar em todas as rotas /api/* (exceto /api/auth dessa máquina)
app.use('/api/tunnel', requireToken);
app.use('/api/logout', requireToken);
// /api/auth/start e /api/auth/poll: exigem token p/ não permitir spawn
app.use('/api/auth', requireToken);
// /api/status: permitir sem auth (public read Estado)
```

**Arquivo:** `hivedocker/public/index.html`

Após `let state = {...}` adicionar:

```js
let panelToken = localStorage.getItem('hivedocker_panel_token') || null;

function requireToken() {
  if (!panelToken) {
    panelToken = prompt('Token do painel:');
    if (panelToken) localStorage.setItem('hivedocker_panel_token', panelToken);
  }
}

// Em todas as chamadas fetch:
async function apiFetch(url, options = {}) {
  requireToken();
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), 'Authorization': `Bearer ${panelToken}` }
  });
}

// Substituir os fetch('/api/...') por apiFetch('/api/...')
```

### Verificação
- `curl http://localhost:8080/api/tunnel/start` sem header → 401.
- Com token → 200.
- Primeiro acesso no browser pedia token, salva em localStorage, lembra em próximos sessions.

---

## 2. B-drift-2 — HiveDocker não respeita KICKED do Broker (reconecta em loop)

### Por que mudar
- Broker envia `CloseNormalClosure` com reason `"KICKED"` em `websocket.go:453` quando admin/remove node via `POST /api/nodes/:id` (que chama `/kick` no broker).
- Apps móveis (`hivenode-app/src/app/index.tsx:591-594`) capturam `e.reason === "KICKED"` e fazem `handleLogout` (limpa AsyncStorage, mostra alerta "removido pelo painel").
- HiveDocker `server.js:124-130` só loga "Túnel Desconectado" e espera. Com `restart: unless-stopped` do docker-compose, container sobe → connectToBroker tenta ( Bike limpar `config.nodeId`) → broker envia kick novamente → loop eterno.
- Atacante que comprometa o painel do admin pode chutar muitos IDs e spawn  solicitações WS em loop no broker.

### Melhoria esperada
- HiveDocker reconhece KICKED e limpa `config.nodeId` + `config.token`.
- Mostra painel "Nó removido pelo painel web — Gere novo device code".
- Sem auto-reconexão.

### Passos e arquivos a editar

**Arquivo:** `hivedocker/server.js`

Substituir o `ws.on('close')` (linhas 124-130):

```js
ws.on('close', (code, reason) => {
  isConnected = false;
  tunnelStartTime = null;
  Object.values(activeSockets).forEach(s => s.destroy());
  ws = null;
  
  const reasonStr = reason.toString('utf8');
  
  if (reasonStr === 'KICKED') {
    addLog('🔨 Este nó foi removido pelo painel. Limpando credenciais...');
    config.nodeId = null;
    config.token = null;
    config.linkToken = null;
    saveConfig();
    // NÃO chamar startTunnel() — espera novo login
    return;
  }
  
  addLog('🛑 Túnel Desconectado');
  // Auto-reconnect exponencial será tratado no item B-drift-6 abaixo
  scheduleReconnect();
});
```

### Verificação
- Painel admin remove o node → HiveDocker loga "removido pelo painel", limpa config.
- Painel hivedocker volta p/ tela inicial "Vincular Dispositivo" — não loopa.

---

## 3. B-drift-6 — HiveDocker sem reconexão exponencial

### Por que mudar
- Apps têm `attemptReconnect` com backoff exponencial + jitter (`hivenode-app/index.tsx:393-406`).
- HiveDocker `server.js` tem zero auto-reconnect. Se broker reinicia `docker compose restart broker`, hivedocker fica offline até amanhã (manual button).
- Em homelab/VPS isto quebra SLA p/ mineradores públicos — uptime é a métrica de pago.

### Melhoria esperada
- Reconnect exponencial: 1s, 2s, 4s, 8s, 16s, 30s cap, com jitter ±20%.
- Reseta retry ao conectar com sucesso.
- Não reconecta se `intentionalLogout` (user clicou parar).

### Passos e arquivos a editar

**Arquivo:** `hivedocker/server.js`

Após `let ws = null` (linha 25), adicionar:

```js
let retryCount = 0;
let reconnectTimer = null;
let intentionalStop = false;

function scheduleReconnect() {
  if (intentionalStop) return;
  
  const baseDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
  const jitter = baseDelay * 0.2 * (Math.random() - 0.5);
  const delay = Math.floor(baseDelay + jitter);
  
  addLog(`⏳ Reconnect em ${Math.round(delay/1000)}s...`);
  reconnectTimer = setTimeout(() => {
    retryCount += 1;
    startTunnel();
  }, delay);
}
```

Mudar `stopTunnel` p/ sinalizar parada intencional:

```js
function stopTunnel() {
  intentionalStop = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.close(); ws = null; }
}

function startTunnel() {
  if (!config.nodeId) {
    addLog("Erro: Aparelho não vinculado");
    return;
  }
  intentionalStop = false;
  retryCount = 0;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  // ... resto da função startTunnel existente
}
```

No `ws.on('open')` (linha 57):

```js
ws.on('open', () => {
  isConnected = true;
  tunnelStartTime = Date.now();
  retryCount = 0;              // <-- reset no sucesso
  addLog("✅ Túnel TCP Reverso Conectado!");
});
```

### Verificação
- `docker compose restart broker` no host alfastage → HiveDocker loga "Reconnect em 1s... 2s... 4s..." e estabiliza em <1 min após o broker voltar.
- `stopTunnel()` manual não dispara reconnect.

---

## 4. P-3 — HiveDocker sem SIGTERM handler (graceful shutdown)

### Por que mudar
- `hivedocker/server.js:211-213`. Express `app.listen` puro. Sem `process.on('SIGTERM')`.
- Container `docker stop` envia SIGTERM, Node.js espera 10s (default) e `SIGKILL` corta abruptamente.
- Em alto tráfego, sockets TCP no meio de uma transferência de 5MB são cortados sem CLOSE p/ o broker → leak de `virtualConns` no TunnelManager.
- Apps móveis têm `notifee.registerForegroundService` (soft kill); o HiveDocker (processo Node) está no zero graceful.

### Melhoria esperada
- Container `docker stop` fecha todos WS e sockets TCP dentro de 5s.
- Zero leak de VirtualConn no Broker.

### Passos e arquivos a editar

**Arquivo:** `hivedocker/server.js`

Antes de `app.listen`:

```js
let server;

function gracefulShutdown(signal) {
  addLog(`🛑 ${signal} recebido. Encerrando graciosamente...`);
  
  // 1. Para WS Broker
  if (ws) {
    ws.close();
    ws = null;
  }
  
  // 2. Fecha todos sockets TCP ativos
  Object.values(activeSockets).forEach(s => s.destroy());
  Object.keys(activeSockets).forEach(k => delete activeSockets[k]);
  
  // 3. Fecha express
  if (server) {
    server.close(() => {
      addLog('✅ Shutdown completo');
      process.exit(0);
    });
    
    // Hard kill se não fechar em 5s
    setTimeout(() => process.exit(1), 5000).unref();
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server = app.listen(8080, '0.0.0.0', () => {
  console.log('HiveDocker running on http://0.0.0.0:8080');
});
```

### Verificação
- `docker stop hivedocker` → logs mostram "Shutdown completo" em <2s.
- Broker não vê mais WS para este nodeId; StatsTx/Rx é flished via `RPUSH traffic_logs` normalmente.

---

## 5. D5 — 3 versões diferentes (1.0.2, 1.0.0, app 1.1.0)

### Por que mudar
- `hivenode-app/src/app/index.tsx:745` mostra `v1.0.2`.
- `hiveminer-app/src/app/index.tsx:811` mostra `v1.0.0 (Miner Edition)`.
- `hivenode-app/package.json:3` é `1.1.0`. Mesmo p/ `hiveminer-app/package.json:3`.
- 3 strings de versão diferentes → suporte não sabe qual versão o cliente está rodando.

### Melhoria esperada
- Versão do `package.json` aparece no rodapé do app (single source of truth).
- Em produção, exibir build hash se disponível.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/src/app/index.tsx`

Importar versão:

```ts
import { version } from "../../package.json";
```

(E precisa do bundler configurado. Mais simples: ler via `expo-constants`):

```ts
import Constants from 'expo-constants';
const appVersion = Constants.expoConfig?.version ?? '?';
```

Substituir linha 745 e 863 por:

```tsx
<Text style={/* estilo rodapé */}>v{appVersion}</Text>
```

**Arquivo:** `hiveminer-app/src/app/index.tsx`

Mesma alteração (linhas 811).

### Verificação
- Abrir app → rodapé mostra "v1.1.0" igual package.json.
- Bump de versão no package.json propaga.

---

## 6. D7 — HiveDocker não envia LOG/TELEMETRY p/ o Broker

### Por que mudar
- Apps móveis `addLog` (`hivenode-app/index.tsx:387-390`) também envia `{"type":"LOG", payload}` ao broker → broker broadcasta `LOG` p/ dashboard web → sightings em tempo real.
- Apps enviam `TELEMETRY` (IP, rede, bateria, uptime) a cada 10s (index.tsx:194-201).
- HiveDocker **não envia nem LOG nem TELEMETRY** → dashboard do Next.js nunca vê atividade/telemetria do HiveDocker. Usuário acha que node está offline porque painel mostra "sem tráfego" mesmo com bytes rolando.

### Melhoria esperada
- HiveDocker envia LOG ao broker a cada evento de tráfego.
- HiveDocker envia TELEMETRY a cada 30s (sem bateria, mas com uptime e tipo de rede p/ Docker — "datacenter" hardcoded).
- Dashboard agora mostra HiveDocker nodes com informação real.

### Passos e arquivos a editar

**Arquivo:** `hivedocker/server.js`

No `ws.on('open')` (linha 55-58), iniciar telemetria:

```js
let telemetryInterval = null;

ws.on('open', () => {
  isConnected = true;
  tunnelStartTime = Date.now();
  retryCount = 0;
  addLog("✅ Túnel TCP Reverso Conectado!");
  
  // Telemetria Docker (sem bateria, rede = datacenter)
  telemetryInterval = setInterval(() => {
    if (!ws || ws.readyState !== 1) return;
    const uptime = tunnelStartTime ? Math.floor((Date.now() - tunnelStartTime) / 1000) : 0;
    ws.send(JSON.stringify({
      type: "TELEMETRY",
      network: "DATACENTER",
      uptime: uptime
    }));
  }, 30000);
});

ws.on('close', () => {
  if (telemetryInterval) clearInterval(telemetryInterval);
  // ... resto existente
});
```

No `addLog` function (linha 30-36):

```js
function addLog(msg) {
  const time = new Date().toLocaleTimeString();
  const logStr = `[${time}] ${msg}`;
  logs.unshift(logStr);
  if (logs.length > 100) logs.pop();
  console.log(logStr);
  
  // Envia pro broker (igual apps móveis)
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "LOG", payload: msg }));
  }
}
```

### Verificação
- Painel do admin com HiveDocker conectado → evento LOG aparece em tempo real no dashboard.
- Card TELEMETRY do HiveDocker mostra "DATACENTER" e uptime subindo.

---

## 7. P-2 — Apps fazem polling `api.ipify.org` a cada 10s (gasta dados BYOD)

### Por que mudar
- `hivenode-app/src/app/index.tsx:170` chama `https://api.ipify.org?format=json` a cada 10s.
- Para BYOD o usuário paga a própria internet móvel (definição do plano BYOD em `HiveNode.md:42`).
- 100k apps = 10k req/s p/ ipify → rate limit / DDoS.
- Broker já tem o IP via `r.RemoteAddr` no `HandleWS` (`websocket.go:225`).

### Melhoria esperada
- Apps não chamam serviço externo.
- IBurn down de dados móveis BYOD cai drasticamente.
- ipify goes back to ~0 RPS.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/src/app/index.tsx` e `hiveminer-app/src/app/index.tsx`

Substituir bloco que faz `ipify` no `fetchNetwork` (linhas 165-209) — deletar a chamada `ipify`. Para display, ler o último IP que o broker pôs no payload de telemetria (broadcast `TELEMETRY` → já recebi payload com `ip`), ou simplesmente não mostrar IP no app:

```ts
const fetchNetwork = async () => {
  try {
    const state = await Network.getNetworkStateAsync();
    let netType = "Desconhecida";
    if (state.type === Network.NetworkStateType.CELLULAR) netType = "4G/5G";
    else if (state.type === Network.NetworkStateType.WIFI) netType = "Wi-Fi";
    setNetworkType(netType);
    
    // IP Externo — removido ipify; podemos mostrar "ver painel" ou indicar que o broker já tem
    setNetworkIp("Broker visível");
    
    if (ws.current?.readyState === WebSocket.OPEN) {
      let batteryLevel = 1;
      try { batteryLevel = await Battery.getBatteryLevelAsync(); } catch (e) {}
      
      let uptime = tunnelStartTime.current
        ? Math.floor((Date.now() - tunnelStartTime.current) / 1000)
        : 0;
      
      ws.current.send(JSON.stringify({
        type: "TELEMETRY",
        network: netType,
        battery: batteryLevel,
        uptime: uptime
      }));
    }
  } catch { }
};
```

### Verificação
- Wireshark no Wi-Fi do celular: nenhuma chamada a `ipify`.
- Painel do broker ainda mostra IP externo (vindo do broker, não do app).

---

## 8. CB-3 — HiveDocker sem `.dockerignore` (build copia config.json/token)

### Por que mudar
- `hivedocker/.gitignore` provavelmente ignora `node_modules`, mas sem `.dockerignore`, `docker build` copia o que está no diretório:
  - `config.json` → pode conter tokens/tokens de autenticação!
  - `node_modules/` (se existir) → bloat, build lento, conflito de platform (compilado p/ host não alpine).
  - `.git/` → histórico do repo, bloat.

### Melhoria esperada
- Build limpo e rápido.
- Zero chance de `config.json` com tokens ir embutido na imagem Docker.
- Imagem reproduzível.

### Passos e arquivos a editar

**Novo arquivo:** `hivedocker/.dockerignore`

```dockerignore
node_modules/
npm-debug.log
.env
.env.*
config.json
.git/
.gitignore
.DS_Store
*.md
!README.md
Dockerfile
docker-compose.yml
.dockerignore
```

### Verificação
- `docker build` log não mostra "COPY leaked config.json".
- `docker run hivedocker ls /app` não mostra `config.json` nem `node_modules`.
- Volume mount `/config.json` em docker-compose.yml still funciona (monta em runtime, não no build).

---

## Resumo P1

| Item | Arquivos | Resultado |
|---|---|---|
| S2 Painel auth token | `hivedocker/server.js`, `hivedocker/public/index.html` | Painel Docker não é DoS físico |
| B-drift-2 KICKED handling | `hivedocker/server.js` | Sem loop de reconexão pós-remoção |
| B-drift-6 Reconnect exponencial | `hivedocker/server.js` | HiveDocker sobrevive a restart broker |
| P-3 SIGTERM handler | `hivedocker/server.js` | Graceful shutdown <3s |
| D5 Versão única | apps `index.tsx` (rodapé) | Suporte sabe versão do cliente |
| D7 LOG/TELEMETRY | `hivedocker/server.js` | Dashboard vê HiveDocker real-time |
| P-2 Sem ipify | apps `index.tsx` (fetchNetwork) | BYOD: economiza dados móveis |
| CB-3 .dockerignore | `hivedocker/.dockerignore` (novo) | Build limpo, sem leak de token |
