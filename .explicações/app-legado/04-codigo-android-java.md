# 04 — Shell Android Java (UI mínima)

> Shell nativo Java. Sem AndroidX, sem Kotlin, sem bibliotecas externas (só Android Support v4). UI foco em Android 4.x.

## 0. Por que Java e não Kotlin

- Kotlin exige Android 4.1+ oficialmente mas em prática só roda confortável a partir de Android 5.x.
- Java 8 lambdas funcionam via desugaring — formeiramente em build-tools 28+. Sem lambdas: `anonymous class`.
- Toolchain AGP 3.0.1 (legado) suporta Java 8 sem problemas.
- Evita plugin Kotlin + coroutine runtime adicional.

## 1. Estrutura final

```
android/legacy/android-app/
├── settings.gradle
├── build.gradle                          # top-level
├── gradle.properties
├── gradlew / gradlew.bat                 # wrapper
└── app/
    ├── build.gradle                       # módulo app
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/br/alfastage/hivenode/legacy/
        │   ├── MainActivity.java          # tela de login + estado
        │   ├── TunnelService.java         # Foreground Service
        │   ├── BootReceiver.java          # auto-start on boot
        │   ├── NetworkReceiver.java       # reconnect on net change
        │   ├── PrefStore.java             # SharedPreferences wrapper
        │   └── LoginApi.java              # HTTPS p/ Web API (login, QR, device code)
        ├── jniLibs/
        │   ├── armeabi-v7a/libhivenode.so
        │   ├── arm64-v8a/libhivenode.so
        │   └── x86/libhivenode.so
        └── res/
            ├── layout/activity_main.xml
            ├── values/strings.xml
            ├── values/colors.xml
            └── drawable/ic_notification.xml
```

## 2. `settings.gradle`

```gradle
include ':app'
```

## 3. `build.gradle` (top-level)

```gradle
buildscript {
    repositories {
        google()
        jcenter()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:3.0.1'
    }
}

allprojects {
    repositories {
        google()
        jcenter()
        flatDir { dirs 'libs' }
    }
}

task clean(type: Delete) { delete rootProject.buildDir }
```

> Usamos AGP 3.0.1 porque AGP mais novo não suporta `compileSdkVersion 22` bem. compileSdk=22 é a min por targetSdk=22.

## 4. `gradle.properties`

```properties
android.useDeprecatedNdk=true
org.gradle.jvmargs=-Xmx2048m
```

## 5. `app/build.gradle`

```gradle
apply plugin: 'com.android.application'

android {
    compileSdkVersion 22
    buildToolsVersion "28.0.3"

    defaultConfig {
        applicationId "br.alfastage.hivenode.legacy"
        minSdkVersion 16          // Android 4.1
        targetSdkVersion 22       // Android 5.1 - antes runtime permissions
        versionCode 1
        versionName "1.0.0-legacy"

        ndk {
            abiFilters 'armeabi-v7a', 'arm64-v8a', 'x86'
        }
    }

    sourceSets {
        main {
            jniLibs.srcDirs = ['src/main/jniLibs']
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }

    packagingOptions {
        exclude 'META-INF/DEPENDENCIES'
        pickFirst '**/libhivenode.so' // evita duplicar se a bund na AAR
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

repositories {
    flatDir { dirs 'libs' }
}

dependencies {
    // AAR gerado pelo gomobile bind
    implementation(name: 'libhivenode', ext: 'aar')

    // Android Support v4 (suporte para NotificationCompat em <API 26)
    implementation 'com.android.support:support-v4:22.0.0'
}

// Signing config - lê keystore de /workspace/android/legacy/signing keystore
android.signingConfigs.release {
    storeFile file(System.env.LEGACY_KEYSTORE ?: '../signing/legacy.keystore')
    storePassword System.env.LEGACY_KEYSTORE_PASS ?: 'hivenode'
    keyAlias System.env.LEGACY_KEY_ALIAS ?: 'hivenode-legacy'
    keyPassword System.env.LEGACY_KEY_PASS ?: 'hivenode'
}
```

## 6. `AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="br.alfastage.hivenode.legacy">

    <!-- Internet (desde API 1) -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

    <!-- WakeLock - manter CPU viva -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- WifiLock - manter Wi-Fi antena alta performance -->
    <uses-permission android:name="android.permission.WIFI_MODE_FULL_HIGH_PERF" /> <!-- API 3 -->

    <!-- Boot completo - auto start -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <!-- Foreground Service (Android 4.0+) -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

    <!-- Wake on Boot - older Android 4.x supports parciais -->
    <application
        android:allowBackup="true"
        android:icon="@drawable/ic_notification"
        android:label="@string/app_name"
        android:theme="@android:style/Theme.Holo.Light"
        android:persistent="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="Hive Legacy">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".TunnelService"
            android:exported="false"
            android:process=":tunnel" />

        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

        <receiver
            android:name=".NetworkReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.net.conn.CONNECTIVITY_CHANGE" />
            </intent-filter>
        </receiver>
    </application>
</manifest>
```

**Pontos importantes**:

- `android:persistent="true"` em `<application>` reduz chance de ser morto pelo system em Android 4.x customizados.
- Service em proceso separado (`:tunnel`) - se UI morrer, túnel mantém.
- `WIFI_MODE_FULL_HIGH_PERF` é a única permission que funciona desde Android 1.6 p/ segurar Wi-Fi sem sleeping.

## 7. `PrefStore.java` — wrapper de SharedPreferences

```java
package br.alfastage.hivenode.legacy;

import android.content.Context;
import android.content.SharedPreferences;

public final class PrefStore {
    private static final String NAME = "hivenode";
    private final SharedPreferences sp;

    public PrefStore(Context ctx) {
        sp = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    public String getToken()       { return sp.getString("token", null); }
    public String getBrokerHost()  { return sp.getString("brokerHost", "broker.hivenode.alfastage.com.br"); }
    public String getNodeId()      { return sp.getString("nodeId", null); }
    public String getTunnelSecret(){ return sp.getString("tunnelSecret", "hivenode_secret_key"); }
    public String getUserEmail()   { return sp.getString("userEmail", null); }
    public String getUserRole()    { return sp.getString("userRole", null); }
    public boolean isAutoStart()   { return sp.getBoolean("autoStart", true); }

    public void saveLogin(String token, String brokerHost, String nodeId, String tunnelSecret,
                          String userEmail, String userRole) {
        sp.edit()
          .putString("token", token)
          .putString("brokerHost", brokerHost)
          .putString("nodeId", nodeId)
          .putString("tunnelSecret", tunnelSecret)
          .putString("userEmail", userEmail)
          .putString("userRole", userRole)
          .apply();
    }

    public void clear() {
        sp.edit().clear().apply();
    }
}
```

## 8. `LoginApi.java` — chamadas HTTPS p/ Web

Usa `HttpURLConnection` (desde API 1, sem dependências). Detalhes dos endpoints em `05-fluxo-login.md`.

```java
package br.alfastage.hivenode.legacy;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public final class LoginApi {
    public static final String DEFAULT_BASE = "https://hivenode.alfastage.com.br";

    private final String baseUrl;
    public LoginApi(String baseUrl) { this.baseUrl = baseUrl; }

    public static class LoginResponse {
        public String token;
        public String userEmail;
        public String userRole;
        public String nodeId;
        public String tunnelSecret;
    }

    // POST /api/auth/login {"email","password"} → {"token","user"}
    public LoginResponse login(String email, String password) throws Exception {
        JSONObject body = new JSONObject();
        body.put("email", email).put("password", password);
        JSONObject resp = post("/api/auth/login", body);

        LoginResponse r = new LoginResponse();
        r.token = resp.getString("token");
        JSONObject user = resp.getJSONObject("user");
        r.userEmail = user.getString("email");
        r.userRole = user.getString("role");
        r.tunnelSecret = user.optString("tunnelSecret", "hivenode_secret_key"); // default até Sprint 3 S1
        r.nodeId = user.optString("nodeId", null); // vincular aparelho depois, ver 05
        return r;
    }

    // POST /api/auth/device-code/generate {"type":"miner|proxy"} → {deviceCode, userCode, verificationUri, expiresIn}
    public JSONObject generateDeviceCode(String type) throws Exception {
        JSONObject body = new JSONObject();
        body.put("type", type);
        return post("/api/auth/device-code/generate", body);
    }

    // POST /api/auth/device-code/poll {"deviceCode":...} → {"status":"pending|success","token":...}
    public JSONObject pollDeviceCode(String deviceCode) throws Exception {
        JSONObject body = new JSONObject();
        body.put("deviceCode", deviceCode);
        return post("/api/auth/device-code/poll", body);
    }

    // POST /api/auth/pair-code {"pairCode":"HV-XXXX"} → {"userId","linkToken"}
    public JSONObject pairCode(String code) throws Exception {
        JSONObject body = new JSONObject();
        body.put("pairCode", code.toUpperCase());
        return post("/api/auth/pair-code", body);
    }

    // POST /api/auth/qr-login {"linkToken":...} → {"token","user"}
    public LoginResponse qrLogin(String linkToken) throws Exception {
        JSONObject body = new JSONObject();
        body.put("linkToken", linkToken);
        JSONObject resp = post("/api/auth/qr-login", body);

        LoginResponse r = new LoginResponse();
        r.token = resp.getString("token");
        JSONObject user = resp.getJSONObject("user");
        r.userEmail = user.getString("email");
        r.userRole = user.getString("role");
        r.tunnelSecret = user.optString("tunnelSecret", "hivenode_secret_key");
        r.nodeId = user.optString("nodeId", null);
        return r;
    }

    private JSONObject post(String path, JSONObject body) throws Exception {
        URL url = new URL(baseUrl + path);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setDoOutput(true);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.toString().getBytes("UTF-8"));
        }
        int code = conn.getResponseCode();
        BufferedReader br = new BufferedReader(
            new InputStreamReader(code >= 400 ? conn.getErrorStream() : conn.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        String respStr = sb.toString();
        if (code >= 400) {
            throw new RuntimeException("HTTP " + code + ": " + respStr);
        }
        // API util em web/src/lib/api-utils.ts envelopa tudo em {success, data}. Pegar data.
        JSONObject envelope = new JSONObject(respStr);
        if (envelope.has("data")) return envelope.getJSONObject("data");
        return envelope;
    }
}
```

> ⚠️ **Pós Sprint 3 S1**: O `LoginResponse.tunnelSecret` deve vir preenchido via `user.tunnelSecret`. Até lá cai pra `hivenode_secret_key`.

## 9. `TunnelService.java` — o coração do app

Foreground Service que mantém o tunel Go vivo.

```java
package br.alfastage.hivenode.legacy;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.app.NotificationCompat;
import android.util.Log;

import mobile.Tunnel;     // <- import gomobile bind
import mobile.StatusCallback;

public class TunnelService extends Service {
    private static final String TAG = "Hive";
    private static final int NOTIF_ID = 10001;

    private static Tunnel tunnel;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private PrefStore prefs;
    private Thread pollerThread;

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = new PrefStore(this);

        // WakeLock partial - não adormece CPU
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hivenode:tunnel");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire();

        // WifiLock high perf - não deixa Wi-Fi antena "dormir"
        WifiManager wm = (WifiManager) getSystemService(Context.WIFI_SERVICE);
        wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "hivenode:wifi");
        wifiLock.setReferenceCounted(false);
        wifiLock.acquire();

        tunnel = Tunnel.newTunnel();
        tunnel.setStatusCallback(new StatusCallback() {
            @Override public void onStatus(final String s) {
                Log.i(TAG, "Status: " + s);
                updateNotification(s);
            }
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification("HiveNode ativo"));

        if (prefs.getNodeId() == null) {
            Log.w(TAG, "sem nodeId vinculado");
            stopSelf();
            return START_STICKY;
        }

        tunnel.start(prefs.getBrokerHost(), prefs.getNodeId(), prefs.getTunnelSecret());
        startPoller();
        return START_STICKY;
    }

    private void startPoller() {
        pollerThread = new Thread() {
            @Override public void run() {
                while (!Thread.interrupted()) {
                    try { Thread.sleep(30000); } catch (InterruptedException e) { break; }
                    String ip = getNetworkIp();
                    String netType = getNetworkType();
                    tunnel.sendTelemetry(ip, netType);

                    String status = tunnel.status();
                    updateNotification(status);
                }
            }
        };
        pollerThread.start();
    }

    private String getNetworkIp() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo ni = cm.getActiveNetworkInfo();
        return ni == null ? "desconhecido" : ni.getExtraInfo();
    }

    private String getNetworkType() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo ni = cm.getActiveNetworkInfo();
        if (ni == null) return "OFFLINE";
        switch (ni.getType()) {
            case ConnectivityManager.TYPE_WIFI: return "WIFI";
            case ConnectivityManager.TYPE_MOBILE: return "MOBILE_" + ni.getSubtypeName();
            default: return "?";
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (pollerThread != null) pollerThread.interrupt();
        if (tunnel != null) tunnel.stop();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        tunnel = null;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private Notification buildNotification(String msg) {
        Intent i = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, i,
            PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this)
            .setContentTitle("HiveNode Legacy")
            .setContentText(msg)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setContentIntent(pi)
            .build();
    }

    private void updateNotification(final String msg) {
        ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE))
            .notify(NOTIF_ID, buildNotification(msg));
    }

    public static Tunnel getTunnel() { return tunnel; }
}
```

**Pontos críticos**:
- `wakeLock.acquire()` sem timeout = adquire pra sempre enquanto Service roda
- `wifiLock.acquire()` idem; `WIFI_MODE_FULL_HIGH_PERF` desde API 3
- `START_STICKY`: sistema reinicia Service post-mortem
- Singleton `tunnel` —drigado p/ permitir重建 da Activity

## 10. `MainActivity.java`

Simples: mostra login (3 botões) ou status.

```java
package br.alfastage.hivenode.legacy;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private PrefStore prefs;
    private EditText txtEmail, txtPassword;
    private TextView txtStatus;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        setContentView(R.layout.activity_main);

        prefs = new PrefStore(this);
        txtEmail = (EditText) findViewById(R.id.txtEmail);
        txtPassword = (EditText) findViewById(R.id.txtPassword);
        txtStatus = (TextView) findViewById(R.id.txtStatus);
        Button btnLogin = (Button) findViewById(R.id.btnLogin);
        Button btnDeviceCode = (Button) findViewById(R.id.btnDeviceCode);
        Button btnPairCode = (Button) findViewById(R.id.btnPairCode);

        if (prefs.getToken() != null && prefs.getNodeId() != null) {
            showStatus();
            startService(new Intent(this, TunnelService.class));
            return;
        }

        btnLogin.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                doLogin(txtEmail.getText().toString(), txtPassword.getText().toString());
            }
        });

        btnDeviceCode.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Intent i = new Intent(MainActivity.this, LoginApi // substituir p/ DeviceCodeActivity
                    // navegação simples - ver 05-fluxo-login.md
                );
                Toast.makeText(MainActivity.this, "Ver 05-fluxo-login.md Device Code", Toast.LENGTH_SHORT).show();
            }
        });

        btnPairCode.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Toast.makeText(MainActivity.this, "Ver 05-fluxo-login.md Pair Code", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void doLogin(final String email, final String password) {
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    LoginApi api = new LoginApi(LoginApi.DEFAULT_BASE);
                    final LoginApi.LoginResponse r = api.login(email, password);
                    final String nodeId;
                    if (r.nodeId != null) {
                        nodeId = r.nodeId;
                    } else {
                        // ainda não registrou aparelho - pega um dos /api/nodes/my-nodes
                        // ver próximo passo em 05-fluxo-login.md "registro do dispositivo"
                        nodeId = "AINDA_REGISTRAR";
                    }
                    prefs.saveLogin(r.token, prefs.getBrokerHost(), nodeId,
                                    r.tunnelSecret, r.userEmail, r.userRole);
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            showStatus();
                            startService(new Intent(MainActivity.this, TunnelService.class));
                        }
                    });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            Toast.makeText(MainActivity.this, "Erro: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
                }
            }
        }).start();
    }

    private void showStatus() {
        setContentView(R.layout.activity_status); // layout simples mostrando status, rx, tx
        TextView tv = (TextView) findViewById(R.id.txtStatus);
        tv.setText("Conectado como " + prefs.getUserEmail() + "\nNodeId: " + prefs.getNodeId());

        TextView rxTx = (TextView) findViewById(R.id.txtRxTx);
        Button stopBtn = (Button) findViewById(R.id.btnStop);
        stopBtn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                stopService(new Intent(MainActivity.this, TunnelService.class));
                prefs.clear();
                finish();
            }
        });

        // Poll status 1/seg
        final TextView finalRxTx = rxTx;
        new Thread() {
            @Override public void run() {
                while (!Thread.interrupted()) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            Tunnel t = TunnelService.getTunnel();
                            if (t != null) {
                                finalRxTx.setText("rx=" + t.rxBytes() + " tx=" + t.txBytes());
                            }
                        }
                    });
                    try { Thread.sleep(1000); } catch (InterruptedException e) { break; }
                }
            }
        }.start();
    }
}
```

## 11. `BootReceiver.java` — auto-start

```java
package br.alfastage.hivenode.legacy;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        PrefStore prefs = new PrefStore(context);
        if (prefs.getToken() != null && prefs.getNodeId() != null) {
            Log.i("Hive", "Boot recebido - iniciando service");
            context.startService(new Intent(context, TunnelService.class));
        }
    }
}
```

## 12. `NetworkReceiver.java` — reconexão em queda de rede

```java
package br.alfastage.hivenode.legacy;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class NetworkReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PrefStore prefs = new PrefStore(context);
        if (prefs.getToken() == null) return;

        // Reinicia Service - Go client detecta server fechado e reconecta c/ backoff.
        Intent svc = new Intent(context, TunnelService.class);
        context.stopService(svc);
        context.startService(svc);
    }
}
```

## 13. `res/layout/activity_main.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<ScrollView
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:padding="16dp">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="HiveNode Legacy"
            android:textSize="28sp"
            android:paddingBottom="24dp" />

        <EditText
            android:id="@+id/txtEmail"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:hint="E-mail"
            android:inputType="textEmailAddress" />

        <EditText
            android:id="@+id/txtPassword"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:hint="Senha"
            android:inputType="textPassword" />

        <Button
            android:id="@+id/btnLogin"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="Entrar" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="ou escolha uma alternativa:"
            android:paddingTop="20dp" />

        <Button
            android:id="@+id/btnDeviceCode"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="Código 6 chars" />

        <Button
            android:id="@+id/btnPairCode"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="QR / Pair Code" />

    </LinearLayout>
</ScrollView>
```

## 14. `res/values/strings.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">HiveNode Legacy</string>
</resources>
```

## 15. `res/values/colors.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="hive_yellow">#FFCC00</color>
</resources>
```

## 16. `res/drawable/ic_notification.xml`

Ícone simples (preto sobre fundo amarelo) — vector drawables só funcionam em API 21+. Para Android 4.1 use PNG 24x24 em `drawable-`:

```
res/
├── drawable/ic_notification.png         # PNG 24x24 RGBA version generica
├── drawable-hdpi/ic_notification.png   # 36x36
└── drawable-xhdpi/ic_notification.png  # 48x48
```

Use qualquer ícone SVG“conversível”. Para simplicity, gere PNGs via `expo` ou `IconButton`.

## 17. Próximo passo

→ [06-build-apk-docker.md](./06-build-apk-docker.md) para gerar o APK assinado.
