# P0 — Críticos: Fluxos Quebrados & Compliance

> Faixa: 2-4 dias. Itens que **rompem o funcionamento** de um cliente ou **bloqueiam publicação**.
> Objetivo: HiveDocker vira nó real, HiveMiner deixa de criar nó privado, apps tratam onboarding sem plano, Permissões Android Prontas p/ Play Store.

---

## 1. C1 + C2 + C3 + N-drift-2 — HiveDocker nunca cria node real

### Por que mudar
- `hivedocker/server.js:192` gera `nodeId = 'DOCKER-' + Math.random()...` localmente — nunca chama `POST /api/nodes`.
- `hivedocker/server.js:189-194` guarda `linkToken` (5 min de vida) mas nunca troca por JWT de sessão (`/api/auth/qr-login`).
- Sem JWT, HiveDocker não pode chamar nenhum endpoint autenticado → nó fica "fantasma" no Broker, sem dono, sem contabilidade, sem aparecer no painel.
- `web/src/app/api/auth/device-code/generate/route.ts:26` constrói `verificationUri = https://host/dashboard/miner` (ou `/proxies`) — mas **nenhuma das duas telas tem UI de aprovação de device-code**. Onboarding é dead-end.

### Melhoria esperada
- HiveDocker executa o fluxo OAuth completo:
  1. `POST /api/auth/device-code/generate` → `deviceCode` + `userCode`.
  2. Usuário aprova no painel (`POST /api/auth/device-code/approve`).
  3. HiveDocker poll → recebe `linkToken`.
  4. HiveDocker troca `linkToken` por `token` (JWT 7 dias) via `POST /api/auth/qr-login`.
  5. HiveDocker cria node real via `POST /api/nodes` (`visibility: PUBLIC`, `deviceName: "HiveDocker"`).
  6. HiveDocker guarda `token` + `nodeId` real em `config.json`.
  7. HiveDocker conecta WS `/tunnel` com HMAC do `nodeId` — Broker agora vê nó legítimo.
- Painel HiveNode ganha tela de aprovação de device-code.

### Passos e arquivos a editar

#### Passo A — HiveDocker termina o OAuth

**Arquivo:** `hivedocker/server.js`

Substituir `POST /api/auth/poll` (linhas 179-200) por:

```js
app.post('/api/auth/poll', async (req, res) => {
  try {
    const { deviceCode } = req.body;
    
    // 1. Poll status pending/approved
    const pollRes = await fetch(`https://${config.serverIp}/api/auth/device-code/poll`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ deviceCode })
    });
    const pollData = await pollRes.json();
    
    if (pollData.data?.status !== 'success' || !pollData.data.token) {
      // ainda pending
      return res.json({ status: 'pending' });
    }
    
    // 2. Troca linkToken (5 min) por JWT de sessão (7 dias)
    const loginRes = await fetch(`https://${config.serverIp}/api/auth/qr-login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ linkToken: pollData.data.token })
    });
    const loginData = await loginRes.json();
    if (!loginData.data?.token) throw new Error('Troca por JWT falhou');
    const jwt = loginData.data.token;
    
    // 3. Cria Node REAL no banco
    const nodeRes = await fetch(`https://${config.serverIp}/api/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({ deviceName: 'HiveDocker', visibility: 'PUBLIC' })
    });
    const nodeData = await nodeRes.json();
    if (!nodeData.data?.node?.id) throw new Error('Falha ao criar node');
    
    // 4. Persistir
    config.linkToken = null; // linkToken já foi trocado
    config.token = jwt;
    config.nodeId = nodeData.data.node.id;
    saveConfig();
    
    res.json({ status: 'success' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
```

Para todas as chamadas autenticadas (futuro `/api/auth/me`, `/api/nodes/:id`), `Authorization: Bearer ${config.token}`.

#### Passo B — Painel: tela de aprovação de device-code

**Novo arquivo:** `web/src/app/dashboard/admin/device-approve/page.tsx`

Tela em `/dashboard/admin/device-approve` (protegida como ADMIN via middleware B1) que:
- Mostra input p/ `userCode` (6 chars).
- `POST /api/auth/device-code/approve` com `{ userCode }`.
- Retorna 200 → mostra "Aprovado! Peça ao HiveDocker p/ clicar em Atualizar."

O endpoint `/api/auth/device-code/approve/route.ts` já existe e está funcional. Integração frontend é o que falta.

#### Passo C — Corrigir `verificationUri` no generate

**Arquivo:** `web/src/app/api/auth/device-code/generate/route.ts:26`

```ts
// antes: const verificationUri = `https://${host}/dashboard/${type === 'miner' ? 'miner' : 'proxies'}`;
// depois (único lugar que tem UI de approval):
const verificationUri = `https://${host}/dashboard/admin/device-approve`;
```

### Verificação
- Ligar HiveDocker → click "Vincular" → recebe `userCode`.
- Painel admin em `/dashboard/admin/device-approve` → digita código → "Approve".
- HiveDocker polla, troca por JWT, cria node real → `docker logs hivedocker` mostra "Node REAL: abc-123".
- Painel do usuário em `/dashboard/miner` agora vê `HiveDocker` na lista.
- Logs/telemetria do Broker começam a chegar.

---

## 2. D2 — HiveMiner no login manual cria nó PRIVATE com nome "HiveNode Android"

### Por que mudar
- `hiveminer-app/src/app/index.tsx:334` envia `deviceName: "HiveNode Android"` (copy-paste do hivenode-app) e **não envia `visibility`**.
- `web/src/app/api/nodes/route.ts:50` faz `safeVisibility = visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE"` — sem visibility, cai p/ PRIVATE.
- Resultado: usuário do HiveMiner que digita email/senha vira **nó privado** — não entra no pool público, não ganha HivePoints, user acha que miner foi broken.
- O caminho QR (linha 261) sim manda `visibility: "PUBLIC"` corretamente. Drift.

### Melhoria esperada
- Ambos caminhos do HiveMiner (manual + QR) criam nó `PUBLIC` com nome `HiveMiner Android`.
- Mineração pública começa imediatamente.

### Passos e arquivos a editar

**Arquivo:** `hiveminer-app/src/app/index.tsx`

Substituir o body do `handleLogin` (linha 333) por:

```ts
body: JSON.stringify({ deviceName: "HiveMiner Android", visibility: "PUBLIC" })
```

**Arquivo:** `hivenode-app/src/app/index.tsx:334` (revisar equivalência)

Confirmar que está `{ deviceName: "HiveNode Android" }` — OK sem visibility, mas adicionar explicitamente `visibility: "PRIVATE"` p/ legibilidade:

```ts
body: JSON.stringify({ deviceName: "HiveNode Android", visibility: "PRIVATE" })
```

### Verificação
- Instalar HiveMiner → login manual → node aparece no painel com tag "PÚBLICO".
- HivePoints começa a subirem no display UI.

---

## 3. D6 — HiveMiner sem botão bateria (Android mata em BG)

### Por que mudar
- `hivenode-app/src/app/index.tsx:770-779` tem botão de otimização de bateria (`IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATIONS_SETTINGS`).
- `hiveminer-app/src/app/index.tsx` **não tem esse botão**.
- Android em modo Doze/App Standby mata serviços em 2-3 minutos p/ apps sem whitelist de bateria.
- Miner "desliga sozinho" → usuário acha que está minerando pontos mas está parado → pierde confiança no Hive Points.
- Miner público depende de **uptime** — é a métrica mais importante.

### Melhoria esperada
- HiveMiner tem botão bateria que abre tela "Ignorar Otimização de Bateria".
- Time-to-kill médio de BG service sobe de ~3 min p/ 8+ horas.
- Uptime médio dos mineradores públicos sobe 5-10x.

### Passos e arquivos a editar

**Arquivo:** `hiveminer-app/src/app/index.tsx`

Adicionar import já existente:
```ts
// já tem: import * as IntentLauncher from "expo-intent-launcher";
// já tem: import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native"; // adicionar se não existir
```

No bloco `headerRow` da tela principal (próximo à linha 757), adicionar o botão bateria antes do "Desvincular":

```tsx
<View style={[styles.headerRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
  <View style={styles.headerInfo}>
    <Text style={[styles.titleSmall, { color: '#34d399' }]}>HiveMiner Web3</Text>
    <Text style={styles.subtitleSmall}>Placa ID: {nodeId.split('-')[0]}</Text>
    <View style={/* badge PUBLIC existente */} />
  </View>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <TouchableOpacity
      onPress={() => {
        if (Platform.OS === 'android') {
          IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        } else {
          Alert.alert("Aviso", "Esta configuração é exclusiva para Android.");
        }
      }}
      style={{ padding: 8, backgroundColor: "rgba(16, 185, 129, 0.1)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.2)" }}
      activeOpacity={0.7}
    >
      <Ionicons name="battery-charging-outline" size={20} color="#10b981" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
      <Text style={styles.logoutText}>Desvincular</Text>
    </TouchableOpacity>
  </View>
</View>
```

### Verificação
- Celular Android: HiveMiner mostra botão bateria no canto superior.
- Click → tela de "Ignorar otimização de bateria" abre.
- Após whitelist, leave app em background por 1h → status no dashboard ainda ONLINE.

---

## 4. D8 + CB-1 — `RECORD_AUDIO` permissão Android desnecessária (Google Play rejeita)

### Por que mudar
- `hivenode-app/app.json:22` e `hiveminer-app/app.json:22` declaram:
  ```json
  "android.permission.RECORD_AUDIO"
  ```
- App não tem funcionalidade de microfone, nem `expo-av`, nem `Audio.Recording` em qualquer arquivo.
- Google Play Policy: permissões de alta sensibilidade (microfone, localização, SMS) requerem **justificativa declarada e revisão humana** durante publish.
- **Publique via Play Store é rejeitado sem justificativa clarificada.** Sem este campo a política atual bloqueia novo release.
- iOS não é afetado (permissions iOS são runtime, declaradas separadamente em `Info.plist`).

### Melhoria esperada
- Android release passa pela Play Store Policy sem review humano p/ este problema.
- App store listing não tem "Microfone" sob permissions (melhor percepção de privacidade).
- -1 permissão alta no APK.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/app.json`

Remover do array `android.permissions`:
```json
"permissions": [
  "android.permission.INTERNET",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
  "android.permission.WAKE_LOCK",
  "android.permission.CAMERA"
  // REMOVIDO: "android.permission.RECORD_AUDIO"
]
```

**Arquivo:** `hiveminer-app/app.json`

Mesma remoção.

### Verificação
- `eas build --profile preview --platform android`.
- `aapt2 dump permissions app.apk | grep RECORD_AUDIO` → não retorna nada.
- Submit Play Store → sem warning de "high-sensitivity permissions".

---

## 5. N-drift-1 — Apps não tratam 403 "sem plano" no onboarding

### Por que mudar
- `web/src/app/api/nodes/route.ts:67` bloqueia criação de node se usuário não tem assinatura:
  ```ts
  if (userSubs.length === 0) {
    return apiError("Você precisa assinar um plano para adicionar aparelhos", 403);
  }
  ```
- Apps móveis (`hivenode-app/src/app/index.tsx:266` e `hiveminer-app:266`) capturam `nodeData.error` e mostram Alert genérico.
- Usuário baixa HiveMiner, escaneia QR → 403 → Alert "Você precisa assinar um plano" → **sem link p/ comprar**. Usuário fica preso e abandona o app.
- Para experiência BYOD, Premium, e HiveMiner isto é a raiz do abandono do onboarding.

### Melhoria esperada
- App detecta 403 especificamente e **abre webview** p/ `/dashboard/billing` na Play Store/Apple Pay (compra de plano).
- Após plano ativo, retry automático da criação do node.
- Onboarding converte lead → cliente pago sem sair do app.

### Passos e arquivos a editar

**Arquivo:** `hivenode-app/src/app/index.tsx` e `hiveminer-app/src/app/index.tsx`

Criar helper reutilizável:

```tsx
import * as WebBrowser from 'expo-web-browser';

const openBillingInWebview = async (token: string) => {
  const url = `https://api.hivenode.alfastage.com.br/dashboard/billing?mobile_token=${token}`;
  await WebBrowser.openBrowserAsync(url);
};
```

Mudar o `nodeRes.ok` block (próximo à linha 262 em ambos apps):

```tsx
const nodeRes = await fetch(getApiUrl(serverAddress, "/nodes"), {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
  body: JSON.stringify({ deviceName: "HiveMiner Android", visibility: "PUBLIC" })
});
const nodeData = await nodeRes.json();

if (!nodeRes.ok) {
  // Tratamento específico para "sem plano"
  if (nodeRes.status === 403) {
    Alert.alert(
      "Assinatura necessária",
      "Você precisa assinar um plano antes de ativar este aparelho. Deseja abrir o painel para assinar agora?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Assinar agora", onPress: () => openBillingInWebview(token) }
      ]
    );
    return; // aborta, não mostra "erro genérico"
  }
  throw new Error(nodeData.error || "Erro ao registrar o aparelho.");
}
```

### Verificação
- Nova conta sem plano → escanear QR → Alert aparece oferecendo "Assinar agora".
- Clicar → webview abre painel de billing → comprar plano → voltar app → re-escanear QR → agora funciona.

---

## 6. C4 — Apps e HiveDocker fazem fallback p/ porta 80 sem validar host

### Por que mudar
- `hivenode-app/src/app/index.tsx:509-510`. Apps usam `hostParts.length > 1 ? parseInt(parts[1], 10) : 80`.
- `hivedocker/server.js:86` usa `parseInt(targetPort) || 80` (different behavior: `parseInt("0") === 0` é falsy → ou 80).
- Nenhum valida se `host` tem formato válido, contém caracteres estranhos, ou aponta p/ IP interno.
- Um payload SOCKS5 malicioso com `host = "192.168.1.1:8080"` ou `host = "/etc/passwd"` é repassado cru p/ o TcpSocket.connect.
- Em HiveDocker (num servidor com rede interna), isso vira **proxy p/ serviços internos** (port scanner / SSRF burglar).

### Melhoria esperada
- Validação simples de host antes de `createConnection`.
- Bloqueio de hosts privados/rede interna em opção configurável (default bloqueia).
- HMAC e fallback de porta consistente entre apps.

### Passos e arquivos a editar

**Arquivo (novo):** `hivenode-app/src/lib/hostValidator.ts` (e cópia p/ `hiveminer-app/src/lib/hostValidator.ts`)

```ts
const PRIVATE_RANGES = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^::1$/];

export function isHostSafe(host: string, allowPrivate = false): boolean {
  if (!host || host.length > 253) return false;
  if (/\s|[<>"'`]/.test(host)) return false; // sem meta chars
  if (host.startsWith("/") || host.startsWith("\\") || host.includes("..")) return false;
  if (host === "localhost") return allowPrivate;
  if (!allowPrivate) {
    return !PRIVATE_RANGES.some(rx => rx.test(host));
  }
  return true;
}

export function parseHostPort(addr: string, defaultPort = 443): { host: string; port: number } {
  // addr = "host:port" ou "host"
  const parts = addr.split(":");
  const host = parts[0];
  const port = parts.length > 1 ? parseInt(parts[1], 10) : defaultPort;
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return { host, port: defaultPort };
  }
  return { host, port };
}
```

**Arquivo:** `hivenode-app/src/app/index.tsx` (e `hiveminer-app` equivalente)

Substituir linhas 505-510 no `onmessage` handler:

```ts
if (type === "DIAL") {
  addLog(`[${connId}] Requisição TCP -> ${host}`);
  
  const { host: targetHost, port: targetPort } = parseHostPort(host, 443);
  
  if (!isHostSafe(targetHost)) {
    addLog(`❌ [${connId}] Host bloqueado: ${targetHost}`);
    ws.current?.send(JSON.stringify({ connId, type: "DIAL_ERR" }));
    return;
  }
  
  try {
    const client = TcpSocket.createConnection({ port: targetPort, host: targetHost }, () => {
      ws.current?.send(JSON.stringify({ connId, type: "DIAL_OK" }));
    });
    // ... resto dos handlers data/error/close
  }
}
```

**Arquivo:** `hivedocker/server.js` (DIAL handler)

```js
const { parseHostPort, isHostSafe } = require('./hostValidator');

if (type === "DIAL") {
  addLog(`[${connId}] Requisição TCP -> ${host}`);
  const { host: targetHost, port: targetPort } = parseHostPort(host, 443);
  
  if (!isHostSafe(targetHost)) {
    addLog(`❌ [${connId}] Host bloqueado: ${targetHost}`);
    ws.send(JSON.stringify({ connId, type: "DIAL_ERR" }));
    return;
  }
  
  const client = new net.Socket();
  client.connect(targetPort, targetHost, () => {
    ws.send(JSON.stringify({ connId, type: "DIAL_OK" }));
  });
  // ... resto inalterado
}
```

### Verificação
- Atacante SOCKS5 conecta → pede `host = "192.168.0.1:22"` → app loga "Host bloqueado" e envia `DIAL_ERR`.
- Apps pararam de ser proxy p/ rede interna.
- Porta 0 ou NaN cair p/ 443 consistentemente em todos os 3 clientes.

---

## Resumo P0

| Item | Arquivos principais | Resultado |
|---|---|---|
| C1+C2+C3+N-drift-2 | `hivedocker/server.js`, `web/src/app/dashboard/admin/device-approve/*`, `web/src/app/api/auth/device-code/generate/route.ts` | HiveDocker vira nó real |
| D2 | `hiveminer-app/src/app/index.tsx:334` | HiveMiner sempre PUBLIC |
| D6 | `hiveminer-app/src/app/index.tsx` (headerRow), `hivenode-app` (revisar) | Miner sobrevive em BG |
| D8+CB-1 | `hivenode-app/app.json`, `hiveminer-app/app.json` | Play Store aceita release |
| N-drift-1 | `hivenode-app/src/app/index.tsx`, `hiveminer-app/src/app/index.tsx` | Onboarding converte sem plano |
| C4 | `hivenode-app/src/lib/hostValidator.ts` (novo), `hiveminer-app` (cópia), `hivedocker/server.js` | 0 SSRF / probing interno |
