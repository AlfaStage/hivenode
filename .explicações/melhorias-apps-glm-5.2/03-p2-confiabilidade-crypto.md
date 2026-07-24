# P2 — Confiabilidade & Crypto nos Apps

> Faixa: 2-3 dias. Items que aumentam segurança, robustez e consistência entre apps.
> Objetivo: tokens não legivei em Android rooted, anti-DNS hijack, drifts finos entre hivenode/hiveminer, heartbeat WS, limpeza de código morto.

---

## 1. S3 — Apps guardam JWT em AsyncStorage (legível em Android rooted)

### Por que mudar
- `hivenode-app/src/app/index.tsx:269` e `hiveminer-app/src/app/index.tsx` idem: `AsyncStorage.setItem("token", token)`.
- AsyncStorage usa SQLite ou arquivo plano em `/data/data/com.hivenode.app/files/RKStorage/` — legível por:
  - Usuário root.
  - Apps com permissão `android.permission.WRITE_EXTERNAL_STORAGE` + `READ_EXTERNAL_STORAGE` (comum em apps de file manager).
  - ADB backup (`adb backup -apk com.hivenode.app`).
- JWT de 7 dias vazado = sessão aberta no painel web por 7 dias.
- HiveMiner (PUBLIC) é ainda mais sensível: token do dono que instalou um celular p/ mineração 24/7 pode ser roubado p/ minerar p/ outro painel.

### Melhoria esperada
- Tokens guardados em **Keychain iOS / KeyStore Android** via `expo-secure-store`.
- ADB backup expulsa app automaticamente (allowBackup=false implícito).
- Mesmo em root, chave fica cifrada com hardware-backed keystore.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/package.json`

Adicionar dependency:
```json
"expo-secure-store": "~14.0.10"
```

Mesmo em `hiveminer-app/package.json`.

**Arquivo:** `hivenode-app/src/app/index.tsx`

Substituir todos `AsyncStorage.getItem("token")` / `setItem("token", ...)`:

```ts
import * as SecureStore from 'expo-secure-store';

// Wrapper compatível com API do AsyncStorage onde faz sentido p/ secret:
async function saveSecret(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY, // nãoo backup iCloud
  });
}

async function getSecret(key: string): Promise<string | null> {
  return await SecureStore.getItemAsync(key);
}

async function deleteSecret(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
```

Trocar:
- `AsyncStorage.setItem("token", token)` → `saveSecret("token", token)`.
- `AsyncStorage.getItem("token")` → `getSecret("token")`.
- No logout: `deleteSecret("token")`.

Manter `AsyncStorage` p/ dados **não sensíveis** (`serverIp`, `nodeId`, `userEmail`, `nodeName`) — não há necessidade de crypto p/ isso.

Mesmas trocas em `hiveminer-app/src/app/index.tsx`.

### Verificação
- `adb backup -apk com.hivenode.app` → falha se app tem secure store; ou extrai só dados públicos.
- Em `device-shell` no celular rooted: `ls /data/data/com.hivenode.app/files/` não mostra RK SQLite com tokens.
- App reinstalado → SecureStore está limpo (utilizador digita email/senha de novo).

---

## 2. S4 — `getApiUrl` matches substring para decidir prod vs dev

### Por que mudar
- `hivenode-app/src/app/index.tsx:43-46`:
  ```ts
  const isProd = address.includes("alfastage.com.br");
  const baseDomain = address.replace("api.", "");
  return isProd ? `https://${baseDomain}/api${path}` : `http://${address}:3000/api${path}`;
  ```
- Se alguém entra `192.168.0.10.alfastage.com.br.evil.com`, `isProd === true` → app tenta HTTPS (pode falhar, sem TLS).
- Mais crítico: host que tem `api.` removed by `.replace("api.", "")` substitui primeira ocorrência; para `api.api.exemplo.com` vira `api.exemplo.com` — incerto.
- Hoje `serverAddress` é hardcoded `api.hivenode.alfastage.com.br` (linhas 219, 311) então o helper é redundante e fonte de bugs.

### Melhoria esperada
- Helper desaparece — todos os endpoints apontam p/ uma única constante.
- Dev/QA pode override via LocalOnly flag se necessário.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/src/app/index.tsx`

Remover `getApiUrl` (linhas 42-46). Substituir por constante:

```ts
const API_BASE = "https://hivenode.alfastage.com.br/api";

// Nas 3 chamadas:
// getApiUrl(serverAddress, "/auth/qr-login")  ->  `${API_BASE}/auth/qr-login`
// getApiUrl(targetServer, "/auth/login")      ->  `${API_BASE}/auth/login`
// getApiUrl(serverAddress, "/nodes")           ->  `${API_BASE}/nodes`
// getApiUrl(serverIp, `/nodes/${nodeId}`)      ->  `${API_BASE}/nodes/${nodeId}`
```

Em desenvolvimento interno, usar Expo Constants:
```ts
import Constants from 'expo-constants';
const API_BASE = Constants.expoConfig?.extra?.apiBase || "https://hivenode.alfastage.com.br/api";
```

Mesmas alterações em `hiveminer-app/src/app/index.tsx`.

### Verificação
- `grep "getApiUrl" hivenode-app/src/app/index.tsx` → sem ocorrências.
- Code search "api.alfastage" reduz p/ 1 constante sola.

---

## 3. S1 — Segredo HMAC `"hivenode_secret_key"` hardcoded (reforço)

### Por que mudar
- Já detalhado no relatório Sprint 3 S1 do plano anterior, mas reforço que os 3 apps são parte do problema:
  - `hivenode-app/src/app/index.tsx:51` (`getWsUrl`).
  - `hiveminer-app/src/app/index.tsx:51` (idem).
  - `hivedocker/server.js:47` (`CryptoJS.HmacSHA256`).
- HiveDocker continua com segredo fixo mesmo que apps móveis sejam corrigidos p/ per-user secret.

### Melhoria esperada
- HiveDocker lê `tunnelSecret` do JWT recebido no login (ver C1 fixado) e usa p/ HMAC.
- Segredo universal desaparece.

### Passos e arquivos a editar

Após Sprint 3 S1 do plano principal (que adicionou `User.tunnelSecret`), integrar:

**Arquivo:** `hivedocker/server.js` (após correção C1 que adicionou JWT)

O login completo `POST /api/auth/qr-login` retorna `user.tunnelSecret` (precisa expandir API Next.js). HiveDocker grava em `config.tunnelSecret`:

```js
config.tunnelSecret = loginData.data.user.tunnelSecret;
saveConfig();

const hmacSig = CryptoJS.HmacSHA256(config.nodeId, config.tunnelSecret).toString(CryptoJS.enc.Hex);
const wsUrl = `wss://${config.serverIp}/tunnel?nodeId=${config.nodeId}&sig=${hmacSig}`;
```

**Arquivo:** `web/src/app/api/auth/qr-login/route.ts`

Expandir response p/ incluir `tunnelSecret` (ou criar endpoint `/api/auth/me` que retorna):

```ts
const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, email: true, role: true, tunnelSecret: true } });
// ...
return apiSuccess({ token, user: { id: user.id, email: user.email, tunnelSecret: user.tunnelSecret } });
```

### Verificação
- Mesmo nodeId com tunnelSecret velho → broker rejeita WS (401).
- APK decompilado (JADX) não expõe segredo fixo.

---

## 4. C4 — Sem validação de host em DIAL (reforço_P2)

### Por que mudar
- Item **C4 do P0** trata disso e é prioritário. Aqui está mencionando como relacionado p/ garantir alinhamento.

### Melhoria esperada
- Mesma do P0 C4: bloqueios de SSRF p/ IPs internos.

### Passos
- Ver 01-p0-fluxos-quebrados.md §6 C4. Esta entrada é referência cruzada.

---

## 5. D1 — Drifts entre hivenode/hiveminer: deviceName inconsistente

### Por que mudar
- `hivenode-app/src/app/index.tsx:334`: `deviceName: "HiveNode Android"`.
- `hiveminer-app/src/app/index.tsx:334`: também "HiveNode Android" (P0 D2 corrige p/ "HiveMiner Android").
- Em handleBarcodeScanned:
  - `hivenode-app:262`: `deviceName: "HiveNode Android"`.
  - `hiveminer-app:262`: `deviceName: "HiveMiner Android", visibility: "PUBLIC"`.
- Há duplicidade de strings desconexadas; padronizar via constante evita edit manual no futuro.

### Melhoria esperada
- Única fonte de verdade p/ identity do app.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/src/app/index.tsx`

Topo do arquivo (próximo às constantes base64), adicionar:

```ts
const APP_IDENTITY = {
  appName: "HiveNode",
  deviceName: "HiveNode Android",
  visibility: "PRIVATE" as const,
  color: "#f59e0b",
};
```

Substituir referências hard-coded:
- `body: JSON.stringify({ deviceName: "HiveNode Android" })` → `JSON.stringify({ deviceName: APP_IDENTITY.deviceName, visibility: APP_IDENTITY.visibility })`.
- `body: JSON.stringify({ deviceName: "HiveNode Android", visibility: "PRIVATE" })` → mesma.

Mesmo em `hiveminer-app`, com valores "HiveMiner Android" / "PUBLIC" / "#10b981".

### Verificação
- Brand do app e do wydar的一致registration.

---

## 6. D3 — HiveMiner tem `handleRenameMobile` mas sem botão na UI

### Por que mudar
- `hiveminer-app/src/app/index.tsx:612` define `handleRenameMobile`. Função nunca é chamada (sem botão na UI).
- `hivenode-app/src/app/index.tsx:756-763` tem botão + ícone `pencil`.
- Função morta = código zumbi.

(Nota: O P0 §3 D6 adicionou botão bateria, mas não o rename. Renomear é feature do BYOD privado — HiveMiner não precisa por natureza miner pública.)

### Melhoria esperada
- Remover função morta do hiveminer-app (-23 linhas) e estado `isRenameOpen`/`editName` (linhas 102-103).
- Reduzir bundle e clarificar escopo.

### Passos e arquivos a editar

**Arquivo:** `hiveminer-app/src/app/index.tsx`

Remover:
- Linha 102-103: `const [isRenameOpen, setIsRenameOpen] = useState(false);` `const [editName, setEditName] = useState("");`
- Linha 612`const handleRenameMobile = async () => { ... }` (até ~633).
- Confirmar nenhum JSX referencia `isRenameOpen`.

Outra opção (recomendada): implementar rename também no HiveMiner p/ consistência. Mas como o miner é PUBLIC, o rename é opcional — dono pode já ter interagido via web panel.

### Verificação
- `grep "handleRename\|isRenameOpen\|editName" hiveminer-app/src/app/index.tsx` → sem ocorrências.

---

## 7. D4 — HiveMiner não exibe `userEmail` no header

### Por que mudar
- `hivenode-app/src/app/index.tsx:765`: `<Text>{!!userEmail && `👤 ${userEmail}`}</Text>`.
- `hiveminer-app/src/app/index.tsx`: não exibe.
- Minerador público tem múltiplas contas → em qual está logado?
- Para dashboards públicos/miner pools, o usuário pode clicar e confirmar.

### Melhoria esperada
- HiveMiner mostra email no header, click abre link p/ email do dono.

### Passos e arquivos a editar

**Arquivo:** `hiveminer-app/src/app/index.tsx`

No bloco `headerInfo` da main screen (perto da linha 757), adicionar abaixo do badge "NÓ PÚBLICO":

```tsx
{userEmail ? (
  <Text style={[styles.subtitleSmall, { color: '#9ca3af', fontSize: 11 }]}>👤 {userEmail}</Text>
) : null}
```

### Verificação
- Após login manual, header mostra "seu@email.com" embaixo do badge PUBLIC.

---

## 8. B-drift-1 — HiveDocker não aplica `NODE_RENAMED`

### Por que mudar
- Broker `cmd/broker/main.go:99-128` quando admin renomeia node → envia JSON `{type: "NODE_RENAMED", newName}` pelo WS.
- Apps móveis capturam e atualizam `nodeName` no storage (`hivenode-app/src/app/index.tsx:499-503`).
- HiveDocker `server.js:82` (handler DIAL) só parseia `DIAL` e `CLOSE`. Ignora `NODE_RENAMED` → painel Docker mostra nome velho p/ sempre.

### Melhoria esperada
- Painel HiveDocker exibe nome atualizado enviado pelo broker.

### Passos e arquivos a editar

**Arquivo:** `hivedocker/server.js` no `ws.on('message')` handler de JSON (próximo à linha 81):

```js
if (type === "NODE_RENAMED" && msg.newName) {
  config.nodeName = msg.newName;
  saveConfig();
  addLog(`✏️ Aparelho renomeado pelo painel: ${msg.newName}`);
  return;
}
```

A UI do `index.html` pode opcionalmente exibir `nodeName` se adicionado ao status response em `/api/status`:

```js
app.get('/api/status', (req, res) => {
  res.json({
    nodeId: config.nodeId,
    nodeName: config.nodeName,  // <-- adicionar
    isConnected,
    uptime: tunnelStartTime ? Math.floor((Date.now() - tunnelStartTime) / 1000) : 0,
    logs: logs.slice(0, 20)
  });
});
```

**Arquivo:** `hivedocker/public/index.html`

Atualizar render p/ mostrar `state.nodeName` ao lado do ID.

### Verificação
- Painel web admin renomeia "HiveDocker Homelab" → HiveDocker logs "✏️ Aparelho renomeado: HiveDocker Homelab".
- Painel `/api/status` retorna esse nome; HTML do hivedocker mostra na header.

---

## 9. B-drift-3 — Nenhum cliente envia ping heartbeat WS

### Por que mudar
- Broker não configura `SetReadDeadline` no WS, confia em TCP keepalive default que pode ser 2h.
- Se Wi-Fi cai "silenciosamente" (TCP nunca manda FIN), broker acha que nó ainda está online → SOCKS5 tenta rotear p/ ele e timeout depois de 10s (vs 20s com P0).
- Apps: `expo`'s `WebSocket` builtin não faz heartbeat nativo confiável.
- HiveDocker: `ws` library permite ping.

### Melhoria esperada
- Client-side ping a cada 30s kaufen-pong. Broker usa gorilla padrão `pong` handler p/ atualizar "last seen".
- Detecção de meio-conexão em <45s em vez de 2h.

### Passos e arquivos a editar

#### Broker Go

**Arquivo:** `broker/internal/tunnel/websocket.go`

Após `conn, err := tm.upgrader.Upgrade(...)` (linha 261):

```go
const (
    pingInterval = 30 * time.Second
    pongWait     = 45 * time.Second
)

_ = conn.SetReadDeadline(time.Now().Add(pongWait))
conn.SetPongHandler(func(string) error {
    _ = conn.SetReadDeadline(time.Now().Add(pongWait))
    return nil
})

// inicia pinger broker-side
go func() {
    ticker := time.NewTicker(pingInterval)
    defer ticker.Stop()
    for {
        select {
        case <-ticker.C:
            tm.mu.Lock()
            err := conn.WriteMessage(websocket.PingMessage, nil)
            tm.mu.Unlock()
            if err != nil { return }
        case <-/* detectar quit */: return
        }
    }
}()
```

No `ReadMessage` (linha 286), já `break` em erro, OK.

#### Apps móveis

- Expo `WebSocket` builtin envia PING frames automaticamente a cada 30s se configurado — mas não expõe API p/ controlar isto. Workaround: enviar "application-level ping" a cada 25s.

**Arquivo:** `hivenode-app/src/app/index.tsx`

No `connectToBroker` (após `ws.current.onopen`):

```ts
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

ws.current.onopen = () => {
  tunnelStartTime.current = Date.now();
  setIsConnected(true);
  retryCount.current = 0;
  // ...existent
  
  heartbeatInterval = setInterval(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "PING" }));
    }
  }, 25000);
};

ws.current.onclose = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  // ...existent
};
```

Broker Go adiciona handler p/ ignorar `PING` (não conta como log):

```go
// no handler JSON:
if msgType == "PING" {
    // silently drop
    continue
}
```

#### HiveDocker

**Arquivo:** `hivedocker/server.js`

`ws` library do Node faz ping automaticamente com `pingInterval`. Configurar no constructor:

```js
ws = new WebSocket(wsUrl, {
  pingInterval: 30000,
  pingTimeout: 10000,
});
```

(Nota: builtin browser WebSocket não suporta isto, mas idéia é HiveDocker.)

### Verificação
- Desligar Wi-Fi do celular (mantém 4G) sem fechar app → broker detecta offline em <45s e broadcast `NODE_OFFLINE`.
- Sem heartbeat: broker ainda mostra online 30+ min depois.

---

## 10. P-5 — Apps têm código morto `encodeBase64`/`decodeBase64` (47 linhas)

### Por que mudar
- `hivenode-app/src/app/index.tsx:54-90` define `encodeBase64` e `decodeBase64` — utils codificados na mão.
- Busca no arquivo não encontra nenhum uso (grep `encodeBase64(`).
- Provavelmente era p/ XC usar `Buffer` de Node.js que não existe em RN.
- 47 linhas de bundle APK que ninguém usa.

### Melhoria esperada
- -50 linhas no bundle nativo.
- Manutenção fácil.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/src/app/index.tsx` e `hiveminer-app/src/app/index.tsx`

Remover linhas 54-90 do `encodeBase64`/`decodeBase64`. Confirmar com `grep "encodeBase64\|decodeBase64"` antes p/ garantir zero referências.

### Verificação
- `grep "encodeBase64" hivenode-app/src/app/index.tsx` → zero ocorrências.
- Bundle APK rebuilt com Linear scale (verificar `expo-bundle-analyzer`).

---

## Resumo P2

| Item | Arquivos | Resultado |
|---|---|---|
| S3 SecureStore | `hivenode-app/package.json`, apps `index.tsx`, `hiveminer-app` eq | JWT não legível em root/backup |
| S4 API_BASE constante | apps `index.tsx` | 0 DNS hijack macro |
| S1 HMAC por usuário | `hivedocker/server.js`, `web/src/app/api/auth/qr-login/route.ts` | 0 segredo universal |
| C4 validação host | ver P0 §6 (cross-ref) | SSRF blocked |
| D1 refs app constants | apps `index.tsx` topo | Brand consistente |
| D3 função morta rename | `hiveminer-app/src/app/index.tsx` | -23 linhas bundle |
| D4 header email | `hiveminer-app/src/app/index.tsx` | Identidade clara |
| B-drift-1 NODE_RENAMED | `hivedocker/server.js`, `public/index.html` | Nome的一致 no painel Docker |
| B-drift-3 Heartbeat WS | apps, broker `websocket.go`, hivedocker `server.js` | Detecção de drop <45s |
| P-5 base64 morto | apps `index.tsx` | -47 linhas bundle |
