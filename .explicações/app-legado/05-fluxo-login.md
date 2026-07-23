# 05 — Fluxo de Login (3 modos)

> Android Legado oferece 3 modos de login. Todos já são suportados pela Web API existente em `web/src/app/api/auth/`.

## 0. Visão geral

| Modo | Endpoint(s) usados | Adequado para | UX |
|---|---|---|---|
| Email + Senha | `POST /api/auth/login` | Aparelhos com teclado (celular) | Formulário simples |
| Código de 6 chars | `/api/auth/device-code/{generate,poll,approve}` | TV Box sem câmera/teclado | Mostra código na TV; usuário aprova pelo PC |
| QR / Pair Code `HV-XXXX` | `/api/auth/pair-code` + `/api/auth/qr-login` | Aparelhos sem email/senha mas tem usuário web autenticado | Usuário gera QR no dashboard, aparelho lê/digita |

## 1. Anatomia dos endpoints (referências ao código atual)

### `POST /api/auth/login`
- **Arquivo**: `web/src/app/api/auth/login/route.ts`
- **Entrada**: `{ email, password }`
- **Saída** (envolto em `{success, data}`):
  ```json
  {
    "token": "JWT...",
    "user": {
      "id": "...",
      "email": "...",
      "role": "CUSTOMER|ADMIN"
    }
  }
  ```
- ⚠️ Hoje **NÃO** retorna `nodeId` nem `tunnelSecret`. Detalhes abaixo em "Registo do dispositivo".

### `POST /api/auth/device-code/generate`
- **Arquivo**: `web/src/app/api/auth/device-code/generate/route.ts`
- **Entrada**: `{ type: "miner" | "proxy" }` (default: `"miner"`)
- **Saída**:
  ```json
  {
    "deviceCode": "<32 hex chars interno>",
    "userCode": "AB3X9Y",              // <<< 6 chars mostrado na TV
    "verificationUri": "https://hivenode.alfastage.com.br/dashboard/proxies",
    "expiresIn": 300
  }
  ```
- **TTL**: 5 minutos (300 s).

### `POST /api/auth/device-code/poll`
- **Arquivo**: `web/src/app/api/auth/device-code/poll/route.ts`
- **Entrada**: `{ deviceCode }`
- **Saída enquanto pending**: `{ status: "pending" }`
- **Saída quando approved**: `{ status: "success", token: "<linkToken JWT>" }`
- **Recomendação**: poll a cada 3 s.

### `POST /api/auth/device-code/approve`
- **Arquivo**: `web/src/app/api/auth/device-code/approve/route.ts`
- Chamado pelo **dashboard web** (não pelo app) — não implementamos no Legado.
- Usuário entra em `/dashboard/miner` ou `/dashboard/proxies` e aprova o `userCode`.

### `GET /api/auth/pair-code`
- **Arquivo**: `web/src/app/api/auth/pair-code/route.ts` (lado `GET` que cria)
- **Chamado pelo dashboard**: usuário logado gera o código `HV-XXXX` (10 minutos TTL) + `token` (linkToken) para formar QR.
- O Legado NÃO chama o GET.

### `POST /api/auth/pair-code`
- **Arquivo**: `web/src/app/api/auth/pair-code/route.ts` (lado `POST`)
- **Entrada**: `{ pairCode: "HV-XXXX" }` (uppercase automático)
- **Saída**: `{ userId, linkToken }` — Troca por JWT no `/qr-login`.

### `POST /api/auth/qr-login`
- **Arquivo**: `web/src/app/api/auth/qr-login/route.ts`
- **Entrada**: `{ linkToken: "JWT..." }`
- **Saída**: `{ token, user: { id, email } }` (JWT canônico)
- **Uso**: terminal de todos fluxos — pega `linkToken` devolve JWT.

## 2. Modo 1: Email + Senha

```
[App Legado]
    │ POST /api/auth/login {"email", "password"}
    ▼
[Web API] (web/src/app/api/auth/login/route.ts)
    │ valida bcrypt, gera JWT
    ▼
[App]
    │ recebe {token, user:{email, role}}
    │ se ainda não tem nodeId → chama POST /api/nodes/register
    ▼ (segue passo "Registro do dispositivo")
    │ prefs.saveLogin(token, brokerHost, nodeId, tunnelSecret, email, role)
    │ startService(TunnelService)
    ▼
[Service Go] → connecta WS /tunnel?nodeId=...&sig=...
```

### Código (já está em `04 MainActivity.java`)

```java
LoginApi api = new LoginApi(LoginApi.DEFAULT_BASE);
LoginApi.LoginResponse r = api.login(email, password);
// r.token, r.userEmail, r.userRole, r.tunnelSecret (default "hivenode_secret_key")
// r.nodeId pode ser null -> registrar deviceId (próxima seção)
```

## 3. Registro do dispositivo (`/api/nodes/register`)

O usuário pode ter zero ou mais aparelhos. Após login, app precisa obter um `nodeId`.

### Se o usuário JÁ TEM aparelho vinculado:
- O próximo passo seria chamar `GET /api/nodes/my-nodes` (não existe ainda — adicionar via `web/src/app/api/nodes/route.ts` GET).
- Para Legado: listar aparelhos; se já existe um marcado p/ este device, usar esse `nodeId`.

### Se PRECISA REGISTRAR novo:
- `POST /api/nodes/register` com:
  ```json
  { "deviceModel": "Android Legacy TV Box RK3226", "type": "BYOD" }
  ```
- Headers: `Authorization: Bearer <token>`
- Resposta: `{ node: { id, proxyUser, proxyPass } }`

> **Endpoint pode ainda não ter `proxyUser`/`proxyPass` expostos** — verificar `web/src/app/api/nodes/route.ts`. Para Legado não usamos SOCKS5 auth (já somos dentro do túnel autenticado por HMAC).

### Código do registro

```java
public void ensureNodeId(String token) throws Exception {
    JSONObject body = new JSONObject();
    body.put("deviceModel", Build.MODEL + " Android " + Build.VERSION.RELEASE);
    body.put("type", "BYOD");
    JSONObject resp = postAuth("/api/nodes/register", body, token);
    // resp.data.node.id
    String nodeId = resp.getJSONObject("data").getJSONObject("node").getString("id");
    prefs.saveNodeId(nodeId); // estender PrefStore.saveLogin p/ incluir nodeId
}
```

## 4. Modo 2: Código de 6 chars (Device Code Flow)

Ideal para TV Box sem câmera e sem teclado.

```
[App Legado] → POST /api/auth/device-code/generate {"type":"proxy"}
                    ↓ recebe {deviceCode, userCode:"AB3X9Y", verificationUri, expiresIn}

[App] mostra na tela:
   "AB3X9Y"
   "Entre no hivenode.alfastage.com.br/dashboard e digite o código"

[App] Timer 3s → POST /api/auth/device-code/poll {"deviceCode"}
                  enquanto status="pending", repete
                  quando status="success", recebe token=<linkToken>

[App] → POST /api/auth/qr-login {"linkToken"}
                  → recebe {token: <JWT>, user: {email, role}}

[App] → ensureNodeId(token JWT)
[App] → prefs.saveLogin + startService(TunnelService)
```

### Código Java (extensão de `MainActivity.java`)

```java
private void startDeviceCodeFlow() {
    new Thread(new Runnable() {
        @Override public void run() {
            try {
                LoginApi api = new LoginApi(LoginApi.DEFAULT_BASE);
                final JSONObject dc = api.generateDeviceCode("proxy");
                final String userCode = dc.getString("userCode");
                final String deviceCode = dc.getString("deviceCode");
                final String uri = dc.getString("verificationUri");

                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        showDialog("Código: " + userCode,
                                "Vá em:\n" + uri + "\ne digite o código. Você tem 5 min.");
                    }
                });

                // Poll 3s até 5 min
                long deadline = System.currentTimeMillis() + 5 * 60 * 1000;
                while (System.currentTimeMillis() < deadline) {
                    JSONObject poll = api.pollDeviceCode(deviceCode);
                    if ("success".equals(poll.optString("status"))) {
                        String linkToken = poll.getString("token");
                        LoginApi.LoginResponse r = api.qrLogin(linkToken);
                        ensureNodeId(r.token);
                        prefs.saveLogin(r.token, prefs.getBrokerHost(),
                                       prefs.getNodeId(), r.tunnelSecret,
                                       r.userEmail, r.userRole);
                        runOnUiThread(new Runnable() {
                            @Override public void run() {
                                showStatus();
                                startService(new Intent(MainActivity.this, TunnelService.class));
                            }
                        });
                        return;
                    }
                    Thread.sleep(3000);
                }
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        showDialog("Expirado", "Reinicie o processo.");
                    }
                });
            } catch (final Exception e) {
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        showDialog("Erro", e.getMessage());
                    }
                });
            }
        }
    }).start();
}
```

## 5. Modo 3: QR Code / Pair Code `HV-XXXX`

Ideal para aparelhos com câmera (legado celular com Android 4.x) ou onde o usuário está autenticado no PC e só quer transferir a sessão.

### Subfluxo A: Aparelho TEM câmera — scanear QR code

```
[Dashboard Web (PC)] - usuário logado - gera QR code:
    GET /api/auth/pair-code → { pairCode: "HV-XXXX", token, expiresAt }
    QR code contém string: "HIVENODE-PAIR:HV-XXXX:linkToken=<JWT>"

[App Legado com câmera] - scanner lib (ZXing 4.x port)
    Lê QR → extrai pairCode "HV-XXXX"
    POST /api/auth/pair-code {"pairCode":"HV-XXXX"} → {userId, linkToken}
    POST /api/auth/qr-login {"linkToken":...} → {token, user}
    ensureNodeId(token)
    prefs.saveLogin(...)
    startService(TunnelService)
```

> **Biblioteca scanner**: infelizmente `expo-camera`/`react-native-camera` não funcionam em Legado. Solução: usar **ZXing 3.x core** (Java puro, suporta Android 2.2+):

```
// app/build.gradle dependencies adicionais:
implementation 'com.google.zxing:core:3.4.1'

// instalar via integration (ver ZXing Android scared /diy)
```

Ou para aparelhos com Android 4.4+ — biblioteca `journeyapps:zxing-android-embedded:3.6.0` suporta API 14+. Mas aumenta o APK em ~500 KB. Ver apêndice abaixo.

### Subfluxo B: Aparelho NÃO tem câmera — digita HV-XXXX

UX ótima para TV Box:

```
[Dashboard Web (PC)] gera o mesmo código HV-XXXX

[App Legado] mostra EditText_pedindo o código

   "Digite o código HV-XXXX exibido no seu painel"

[App] → POST /api/auth/pair-code {pairCode}
[App] → POST /api/auth/qr-login {linkToken}
... resto idêntico
```

### Código Java (MainActivity handler)

```java
private void doPairCode(final String pairCode) {
    new Thread(new Runnable() {
        @Override public void run() {
            try {
                LoginApi api = new LoginApi(LoginApi.DEFAULT_BASE);
                JSONObject pair = api.pairCode(pairCode);
                String linkToken = pair.getString("linkToken");
                LoginApi.LoginResponse r = api.qrLogin(linkToken);
                ensureNodeId(r.token);
                prefs.saveLogin(r.token, prefs.getBrokerHost(),
                                prefs.getNodeId(), r.tunnelSecret,
                                r.userEmail, r.userRole);
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        showStatus();
                        startService(new Intent(MainActivity.this, TunnelService.class));
                    }
                });
            } catch (final Exception e) {
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        Toast.makeText(MainActivity.this, "Erro: " + e.getMessage(),
                                Toast.LENGTH_LONG).show();
                    }
                });
            }
        }
    }).start();
}
```

## 6. Apêndice: ZXing scanner integrado (opcional)

Para Android 4.4+:

```gradle
// app/build.gradle - dependencies:
implementation 'com.journeyapps:zxing-android-embedded:3.6.0'
implementation 'com.google.zxing:core:3.4.1'
```

```java
// MainActivity.java
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

private void startQrScanner() {
    IntentIntegrator integrator = new IntentIntegrator(this);
    integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);
    integrator.setPrompt("Aponte para o QR do painel HiveNode");
    integrator.setBeepEnabled(false);
    integrator.initiateScan();
}

@Override
protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
    if (result != null) {
        if (result.getContents() == null) {
            Toast.makeText(this, "Cancelado", Toast.LENGTH_SHORT).show();
            return;
        }
        String s = result.getContents();
        // Formato esperado: HIVENODE-PAIR:HV-XXXX:linkToken=<JWT>
        String[] parts = s.split(":");
        for (String p : parts) {
            if (p.startsWith("HV-")) {
                doPairCode(p);
                return;
            }
        }
        Toast.makeText(this, "QR inválido", Toast.LENGTH_SHORT).show();
    } else {
        super.onActivityResult(requestCode, resultCode, data);
    }
}
```

### Não recomendado para Android 4.1-4.3
- ZXing Android 3.6.0 diz minSdk 14 mas sua `CameraManager` pode falhar em certos journal Android 4.1.
- Recomendado: focar o fluxo 3B (digitação do código HV-XXXX) para Android 4.1-4.3.

## 7. Migração Sprint 3 S1 — quando broker aceitar tunnelSecret por usuário

Referência: `.explicações/melhorias-glm-5.2/03-sprint-seguranca-critica.md` linhas 8-108.

### Antes (hoje)
- Broker valida HMAC com `"hivenode_secret_key"` hardcoded (`broker/internal/tunnel/websocket.go:215`).
- Todos os apps (`hivenode-app`, `hiveminer-app`, `hivedocker`, Legado) usam esse mesmo segredo.

### Depois (pós Sprint 3 S1)
- `User.tunnelSecret: String @default(uuid())` em `prisma/schema.prisma`
- `POST /api/auth/login` retorna `user.tunnelSecret` no JWT
- Broker `HandleWS` consulta `user_tunnel_secret:{nodeId}` no Redis (setado após login pela web)
- Apps precisam passar `tunnelSecret` (não mais hardcoded) para assinar WS

### O que muda no Legado

1. **`web` API**: `POST /api/auth/login`, `/qr-login`, `/pair-code`, `/device-code/poll` (no caso de sucesso) — adicionar `tunnelSecret` no campo `user` do response. Já documentado em `03-sprint-seguranca-critica.md:54-56`.

2. **`LoginApi.LoginResponse.tunnelSecret`**: já está pronto pra receber — só precisa parar de fazer `.optString("tunnelSecret", "hivenode_secret_key")` (default fallback).

3. **`PrefStore.saveLogin`**: já guarda `tunnelSecret` em SharedPreferences.

4. **`TunnelService.onStartCommand`** já passa `prefs.getTunnelSecret()` para `tunnel.start(...)`.

5. **`mobile/mobile.go Start()`** já converte `tunnelSecret string` em `[]byte` e repassa.

→ **Result:** quando você aplica Sprint 3 S1 no broker/web, só precisa:
- Atualizar `web/src/app/api/auth/login/route.ts` para incluir `tunnelSecret: user.tunnelSecret` no JSON (já documentado).
- Reconstruir o APK Legado (mesmo código!).
- Re-bildar Broker (já documentado em Sprint 3).

Nada muda no Legado Android código — adaptação já está pronta desde o start.

## 8. Próximo passo

→ [06-build-apk-docker.md](./06-build-apk-docker.md) para gerar o APK assinado.
