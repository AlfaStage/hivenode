# 07 — Teste e Deploy

> Validação completa: emulador Android 4.4, perfilagem de RAM/CPU/bateria, sideload em TV Box real, fluxo de auto-update.

## 1. Emulador Android 4.4 (API 19)

### Criar AVD Android 4.4

Dentro do container builder ou no host:

```bash
# No container:
$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd \
    -n legacy-api19 \
    -k "system-images;android-19;default;armeabi-v7a" \
    -d 5  # Nexus 5
# (baixa imagem de emulador)
yes | sdkmanager "system-images;android-19;default;armeabi-v7a" > /dev/null
avdmanager create avd -n legacy-api19 -k "system-images;android-19;default;armeabi-v7a"
```

> ⚠️ **Atenção**: Android 4.x emulador só roda em x86 (host). APK Legado tem ABI x86 por isso (não rodar em armeabi-v7a em host x86).

### Iniciar emulador

```bash
# No host (ou outro terminal do container):
emulator -avd legacy-api19 -no-audio -no-window -no-snapshot -gpu swiftshader_indirect &
# Aguardar 30-60s boot completo
adb wait-for-device
adb shell input keyevent 82 # unlock
```

### Verificar boot

```bash
adb shell getprop ro.build.version.release
# Esperado: 4.4.x
adb shell getprop ro.build.version.sdk
# Esperado: 19
```

## 2. Instalar APK no emulador

```bash
# Dentro do container, APK generado em /workspace:
adb install -r /workspace/android/legacy/hivenode-legacy-1.0.0.apk

# Verificar instalação
adb shell pm list packages | grep hivenode
# Esperado: package:br.alfastage.hivenode.legacy
```

## 3. Testar fluxos de login

### Teste 3.1 — Email/senha

1. `adb shell am start -n br.alfastage.hivenode.legacy/.MainActivity`
2. No emulador:
   - Email: `seu_usuario@exemplo.com`
   - Senha: `<sua senha real>`
   - Tap `Entrar`
3. Verificar logs:
   ```bash
   adb logcat -s Hive:V
   ```
   Esperado:
   ```
   I/Hive: Status: ONLINE rx=0 tx=0 conns=0
   ```

4. Verificar dashboard web — deve aparecer `Node ONLINE` em `/dashboard/proxies` (Redis PubSub já configurado no `broker/internal/tunnel/websocket.go:297-304`).

### Teste 3.2 — Device Code (sem email/senha)

1. No app (apenas matar o service primeiro):
   ```bash
   adb shell am force-stop br.alfastage.hivenode.legacy
   adb shell am clear br.alfastage.hivenode.legacy
   adb shell am start -n br.alfastage.hivenode.legacy/.MainActivity
   ```
2. Tap `Código 6 chars` (ver 04 MainActivity handler `btnDeviceCode`).
3. Anote o código da tela (ex: `AB3X9Y`).
4. No seu PC, abra `https://hivenode.alfastage.com.br/dashboard/proxies` e procure a UI de "Aprovar código".
   > **Endpoint já existe**: `POST /api/auth/device-code/approve` em `web/src/app/api/auth/device-code/approve/route.ts`. UI do dashboard pode ou não estar pronta — teste manualmente:
   ```bash
   # No host (precisa estar logado no web para pegar cookie):
   curl -X POST -b cookies.txt -H "Content-Type: application/json" \
       -d '{"userCode":"AB3X9Y"}' \
       https://hivenode.alfastage.com.br/api/auth/device-code/approve
   ```
5. Observar logs do app. Dentro de 3s deve mostrar:
   ```
   I/Hive: Status: ONLINE rx=0 tx=0 conns=0
   ```

### Teste 3.3 — Pair Code (HV-XXXX)

Similar ao teste 3.2 mas:

1. No seu PC, logado no dashboard:
   ```bash
   curl -X GET -b cookies.txt \
       https://hivenode.alfastage.com.br/api/auth/pair-code
   # Resposta: {"data":{"pairCode":"HV-ABCD","token":"...","expiresAt":"..."}}
   ```
2. No app:
   - Tap `QR / Pair Code`.
   - Inserir `HV-ABCD` no EditText.
   - Botão confirmar.

## 4. Performance profiling

### 4.1 — Tamanho do APK
```bash
adb shell ls -la /data/app/br.alfastage.hivenode.legacy*/base.apk
# Ou no seu workspace host:
ls -lh /workspace/android/legacy/hivenode-legacy-*.apk
```
**Meta**: < 5 MB.

### 4.2 — Memória RSS
```bash
adb shell dumpsys meminfo br.alfastage.hivenode.legacy | head -20
```
Linhas importantes:
- `TOTAL PSS:` RAM total usada pelo processo
- `Native Heap:` consumido pelo .so Go (memória legítima)
- `Dalvik Heap:` consumido pela JVM Java (≈ menor)

**Metas**:
- Idle (apenas foreground service rodando): `< 20 MB`
- 100 conexões ativas (via iperf via túnel SOCKS5): `< 50 MB`

### 4.3 — CPU
```bash
adb shell top -m 5 -d 1 -n 10 | grep hivenode
```
**Metas**:
- Idle: CPU `< 1%`
- Under 10 Mbps: CPU `< 15%`

### 4.4 — Bateria
```bash
# Reset stats
adb shell dumpsys batterystats --reset
# ... faz rodar o app por 1h em túnel ...
adb shell dumpsys batterystats > /tmp/stats.txt
# Buscar o bloco do seu pacote:
grep -A 50 "br.alfastage.hivenode" /tmp/stats.txt | head -60
```
**Meta**: menor que 5%/hora em idle (TV Box legado sem muitos apps).

### 4.5 — Conexões simultâneas

No host (PC), via Evolution ou socks5 client contra broker:

```bash
# 100 socks5h simultaneous requests via broker
docker run --rm \
    -v $PWD/scripts:/scripts python:3-alpine \
    python /scripts/stress_test.py --broker wss://broker.hivenode.alfastage.com.br:10000 \
                                   --user <proxyUser> --pass <proxyPass> \
                                   --conns 100 --duration 60s \
                                   --url https://httpbin.org/get
```

Ver no emulador:
```bash
adb shell dumpsys meminfo br.alfastage.hivenode.legacy | grep "TOTAL PSS"
adb logcat -s Hive:V | head -20
```

## 5. TV Box real — sideload

### 5.1 — Preparar TV Box

1. Habilitar `Settings > Developer Options`:
   - Vá em `Settings > About` e toque 7x em `Build number`.
2. Habilitar `USB Debugging` em `Developer options > USB Debugging`.
3. Conectar TV Box via cabo USB-RJ45 (na maioria dos modelos funciona). Ou usar rede ADB:
   ```
   adb connect 192.168.1.42:5555
   ```
4. Verificar:
   ```bash
   adb devices
   # List of devices attached
   # 192.168.1.42:5555    device
   ```

### 5.2 — Sideload

```bash
adb -s 192.168.1.42:5555 install -r hivenode-legacy-1.0.0-universal.apk
```

> **Instalação sem ADB (TV Box sem USB)**:
> 1. Coloque o APK em um pendrive USB.
> 2. Plugue na TV Box.
> 3. Use um explorador de arquivos instalado (File Manager, FX, ES Explorer) para rodar o APK.

### 5.3 — Teste na TV Box

1. Inicie `HiveNode Legacy` no launcher da TV Box.
2. **Sem mouse / só controle remoto**: o **Modo 3 (Pair Code)** é o único factível — escolher digitar `HV-XXXX` no controle.
3. **Com teclado USB conectado**: Modo 1 (email/senha) funciona.

### Boot test

1. Faça login completo.
2. Desligue a TV Box e ligue de novo.
3. Verificar se serviço subiu sozinho (`BootReceiver`):
   ```bash
   adb shell dumpsys activity services br.alfastage.hivenode.legacy
   # Deve aparecer TunnelService running
   ```

### Wi-Fi↔3G switch test (para celular antigo)

1. Login na rede Wi-Fi.
2. ConecteService rodando OK, verific painel.
3. Desligue Wi-Fi. Ative 3G.
4. Aguarde ~30s. Deve reconectar sozinho (via `NetworkReceiver`).
5. Verificar no painel: apareceu como "OFFLINE" e depois "ONLINE".

## 6. Auto-update (DownloadManager)

### Setup endpoint de atualização

No `web/routes`:

```ts
// web/src/app/api/apk/legacy-version/route.ts
import { apiSuccess } from "@/lib/api-utils";

export async function GET() {
  return apiSuccess({
    version: "1.0.1",  // bump quando novo APK
    url: "https://hivenode.alfastage.com.br/apk/hivenode-legacy-1.0.1-universal.apk",
    minSdk: 16,
  });
}
```

Hospede os APKs em `/web/public/apk/hivenode-legacy-X.Y.Z-universal.apk`.

### Code Android (extra — `UpdateChecker.java`)

```java
package br.alfastage.hivenode.legacy;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class UpdateChecker {
    public static void checkAndPrompt(final Context ctx) {
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    URL url = new URL(LoginApi.DEFAULT_BASE + "/api/apk/legacy-version");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    BufferedReader br = new BufferedReader(
                            new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    JSONObject envelope = new JSONObject(sb.toString());
                    JSONObject data = envelope.getJSONObject("data");
                    String newVersion = data.getString("version");
                    String downloadUrl = data.getString("url");

                    PackageManager pm = ctx.getPackageManager();
                    String curVersion = pm.getPackageInfo(
                            ctx.getPackageName(), 0).versionName;

                    if (newVersion.compareTo(curVersion) > 0) {
                        triggerDownload(ctx, downloadUrl);
                    }
                } catch (Exception e) {
                    // silencioso
                }
            }
        }).start();
    }

    private static void triggerDownload(Context ctx, String url) {
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                "hivenode-legacy-update.apk");
        request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        dm.enqueue(request);
    }
}
```

Chame dentro de `BootReceiver.onReceive()` ou periodicamente em uma WorkTask do Service — Android 4.4 tem `DownloadManager` (desde API 9).

### Disparar instalação automaticamente
O usuário precisa aprovar a instalação (não há como instalar silencioso sem root). O `DownloadManager` já abre o instalador após baixar.

## 7. Smoke test final (checklist)

Rodar PR antes de release:

- [ ] APK size < 5 MB (`ls -lh`)
- [ ] Instalado e abriu em Android 4.4 emulador
- [ ] Email+senha logou e conectou → painel mostra ONLINE
- [ ] Device Code (6 chars) funcione — usuário aprovou no dashboard e app logou
- [ ] Pair Code (HV-XXXX) funcione via digitação
- [ ] QR Code scan — se aparelho tem câmera (recomendado Android 4.4+)
- [ ] Reboot da TV Box → service auto-start
- [ ] Wi-Fi→3G switch → reconectou em < 30s
- [ ] iperf via broker via Legado → 50+ Mbps throughput
- [ ] 100 conexões simultâneas → RAM < 50 MB
- [ ] Logout → limpa prefs e para service
- [ ] `kill -9` do processo → Broker detectou OFFLINE via WS close (referência `websocket.go:321-339`)
- [ ] Desinstalar: limpa tudo (apenas APK; sem vestígio)

## 8. Rollback

Se um release esteve ruim:
1. Bump `versionName` de `app/build.gradle` para `1.0.1-bad`.
2. Antigo APK continua instalado nas TVs (não auto-atualiza sem comando).
3. Para reverterir máquinas atuais:
   - Update via endpoint `/api/apk/legacy-version` retornar URL do APK anterior.
4. Ou — se o aparelho bricked: sideload manual.

## 9. Próximo passo

**Adicione referências no README.md principal do projeto**:

```markdown
### App Android Legado (Android 4.1-5.1)

Para aparelhos antigos e TV Box. Documentação completa:
→ .explicações/app-legado/README.md
```

E confirme que o `.gitignore` em `android/legacy/` está completo:

```
android/legacy/android-app/build/
android/legacy/android-app/.gradle/
android/legacy/native-go/build/
android/legacy/signing/legacy.keystore
android/legacy/*.apk
android/legacy/app-release-aligned.apk
```

Pronto para enviar PR e usar como bug → feature ticket.

---

## 🎯 Resumo final

O HiveNode Legacy é:
- APK ~3-5 MB com Shell Java + `libhivenode.so` Go via gomobile.
- Compatível com Android 4.1+ (API 16). 99% do mercado de TV Box legado.
- Reusa 100% do protocolo WS existente no broker (`broker/internal/tunnel/websocket.go`).
- Suporta os 3 modos de login já implementados no Web API.
- Build via Docker: nada de SDK/NDK no seu PC.
- Apk assinado, entregue via `DownloadManager` auto-update.

Boa sorte reinventando aparelhos velhos como nós revolucionários de proxy SOCKS5h.
