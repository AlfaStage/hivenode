# 01 — Arquitetura do HiveNode Legacy

> Leia isto primeiro. Explica **por quê** das decisões e os limites do projeto.

## 1. O problema

Aparelhos Android antigos (4.1 a 5.1) têm:
- 512 MB a 1 GB de RAM (TV Box freqüentemente roda Netflix simultâneo).
- CPU cortex-A53 ou mais fraca — 4 núcleos no máximo.
- Android customizado, sem Play Services, sem Play Protect (não aceitam apps da loja).
- Rede limitada: 3G ou Wi-Fi N (150 Mbps máximo). Sem 4G/5G.

Mesmo assim, dariam excelentes nós de proxy SOCKS5h para o HiveNode. O problema é que **não dá pra usar o app Expo moderno** porque ele exige Android 6.

## 2. A solução: binário Go embutido + UI Java mínima

```
┌─────────────────────────────────────────────┐
│  APK HiveNode Legacy (~3 MB)                │
│                                             │
│  ┌────────────────────────────────────┐     │
│  │ Shell Java/U1 (Android nativo)     │     │
│  │  - MainActivity                    │     │
│  │  - TunnelService (Foreground)      │     │
│  │  - BootReceiver, NetworkReceiver   │     │
│  │  - NotificationCompat (legacy)     │     │
│  └────────────────────────────────────┘     │
│  ┌────────────────────────────────────┐     │
│  │ libhivenode.so  (Go via gomobile) ←┼─ binário .so compilado
│  │  - WebSocket client to broker      │     │   reusa broker/internal/tunnel/*
│  │  - Protocolo binário idêntico      │     │
│  │  - SOCKS5h local resolver          │     │
│  │  - DNS cache LRU                   │     │
│  │  - TCP read/write pump             │     │
│  │  - Byte counter → WS telemetry     │     │
│  │  - Self-heal/reconnect backoff     │     │
│  └────────────────────────────────────┘     │
│  SharedPreferences: token, brokerHost,      │
│                     tunnelSecret, nodeId    │
└─────────────────────────────────────────────┘
```

### Por quê Go + gomobile e não:
- **Flutter**: minSdk 16 funciona, mas APK >15 MB + engine própria ~20 MB RAM só pro shell.
- **Cordova/Capacitor**: WebView em Android 4.x é lento e inconsistente.
- **React Native**: exige minSdk 23.
- **Kotlin puro**: exigiria retraduzir toda a lógica do broker Go, retrabalho.
- **Native�� C++**: demasiado esforço de bind/dk para o ganho.

**Go+gomobile**]
- Reusa 100% do que já está em `broker/internal/tunnel/*` (copiar/adaptar, não reescrever).
- APK mínimo: o `.so` Go tem ~2 MB; shell Java <1 MB; assets mínimos.
- Performance nativa: gomobile gera código arm64-v8a/armeabi-v7a/x86/x86_64 direto.
- `crypto/tls` funciona em Android 4.1 sem BoringSSL (Go usa própria impl).
- Runtime GC controlado por GCPercent + SetMemoryLimit.

### Limites confirmados do gomobile (ver docs oficiais em https://pkg.go.dev/golang.org/x/mobile/cmd/gomobile)
- `gomobile bind`: `-target android` exige API 16+ (Android 4.1). Não suporta Android 2.x.
- `gomobile build`: idem, mínimo `-androidapi 16`.
- Requer `ANDROID_HOME` apontando p/ SDK com platforms;android-22, build-tools, NDK.

## 3. Estrutura de pastas proposta

```
android/
└── legacy/                              # HiveNodeLegacy
    ├── native-go/                        # Código Go mora aqui
    │   ├── go.mod                         # reposítorio Go separado
    │   ├── go.sum
    │   ├── tunnel/
    │   │   ├── websocket.go              # Cliente WS do broker
    │   │   ├── socks.go                  # Recebe "DIAL(dest)" e abre TCP
    │   │   ├── resolver.go               # DNS resolve local c/ cache LRU
    │   │   ├── pump.go                    # io.Copy bidirecional
    │   │   └── protocol.go              # Constantes do protocolo binário
    │   ├── stats/
    │   │   └── counter.go                 # Conta bytes, envia TELEMETRY
    │   ├── auth/
    │   │   └── hmac.go                    # HMAC-SHA256 c/ segredo
    │   └── mobile/
    │       └── mobile.go                  # Bind gomobile: Start/Stop/Status
    ├── android-app/
    │   ├── settings.gradle
    │   ├── build.gradle                   # AGP 3.0.1,jniLibs packaging
    │   ├── app/
    │   │   ├── src/main/
    │   │   │   ├── java/br/alfastage/hivenode/legacy/
    │   │   │   │   ├── MainActivity.java
    │   │   │   │   ├── TunnelService.java
    │   │   │   │   ├── BootReceiver.java
    │   │   │   │   ├── NetworkReceiver.java
    │   │   │   │   ├── PrefStore.java
    │   │   │   │   └── LoginApi.java
    │   │   │   ├── res/
    │   │   │   │   ├── layout/activity_main.xml
    │   │   │   │   ├── layout/fragment_login.xml
    │   │   │   │   ├── values/strings.xml
    │   │   │   │   ├── values/colors.xml
    │   │   │   │   └── drawable/ic_notification.xml
    │   │   │   ├── jniLibs/
    │   │   │   │   ├── armeabi-v7a/libhivenode.so
    │   │   │   │   ├── x86/libhivenode.so
    │   │   │   │   └── arm64-v8a/libhivenode.so
    │   │   │   └── AndroidManifest.xml
    │   │   └── build.gradle
    │   └── gradle/wrapper/...
    ├── hiveminer-variant/               # Pasta-irmaã
    │   └── ... MESMA estrutura, apenas
    │       #泡泡 # diferente package Java e assets/icones
    └── build.sh                           # Orquestra: gomobile bind + gradle assembleRelease
```

> **HiveMiner Legacy vs HiveNode Legacy**: 99% do código Go é compartilhado. Diferenças:
> - App ID Java (`br.alfastage.hivenode.miner` vs `br.alfastage.hivenode.proxy`).
> - Ícone, nome visível, podemos chamar de "Miner" ou "Node".
> - Uma flag que muda o `type=miner` no `/api/auth/device-code/generate` (ver 05).
> - Pois o Broker faz rate-limit diferente: 1 miner/IP vs 10 nodes/IP (`websocket.go:242-257`).

## 4. Fluxo do pacote (data flow)

```
[Broker Go escuta SOCKS5:1000]
        │
        │ cliente SOCKS5 (Evolution) conecta
        ▼
[Broker: socks5.go aceita, consulta Redis p/ auth, obtém nodeID do JWT]
        │
        │ constroi VirtualConn → escreve "DIAL dest:port" no WS do Android
        ▼
[Android Legado: tunnel/websocket.go recebe JSON DIAL]
        │
        │ tunnel/socks.go chama net.Dial("tcp", "dest:port")
        │ tunnel/resolver.go resolve DNS local (com cache se quiser)
        ▼
[Conexão remota OK → envia DIAL_OK de volta ao broker]
        │
        │ broker Go: io.Copy entre VirtualConn (WS) e conn SOCKS5
        │ Android: io.Copy entre WS bytes e TCP real
        ▼
[Bytes fluem nas duas direções — broker tem stats.Tx/Rx via atomic.AddUint64]
        │
        │ Android manda TELEMETRY periodicamente (rx/tx/CPU/...)
        ▼
[Painel Web recebe via WS → dashboard atualiza em tempo real]
```

## 5. Escolhas de performance

| Decisão | Motivo |
|---|---|
| `runtime.GOMAXPROCS(2)` | TV Box tem frequentemente 4 núcleos fracos. Mais de 2 faz GC contention sem lucro. |
| `runtime.SetMemoryLimit(32 << 20)` | Limita heap Go a 32 MB — força GC antes. Deixa o equivalente em RAM pra TV Box Netflix. |
| `runtime.GCPercent = 50` | GC 2x mais frequent. Tamanho do heap fica menor. Crítico em 512 MB total. |
| Buffer `io.Copy` = 32 KB | Padrão Go é 32 KB; não mexer. Menor = mais syscalls. Maior = mais memória. |
| WS mo pingInterval 60 s | Reconhece reconexão rápida sem worsen wakeup loop. |
| DNS cache LRU 100 entradas / TTL 5 min | Evita custos DNS no link 3G lento. |
| Backoff reconnect 1 s→30 s c/ jitter | Evita thundering herd quando broker cai. |
| WakeLock only on traffic | Adquire só quando há túneis ativos. Libera 1 minuto idle. |
| WifiLock `WIFI_MODE_FULL_HIGH_PERF` | Mantém Wi-Fi antena ligada sem desligar pra saving. Desde API 3. |
| Notification Foreground | Necessário p/ o OOM-killer não matar o serviço. |
| JAVA SEM AndroidX | AndroidX exige Android 4.4+ e bibliotecas extras. Usamos Android Support v4 legado. |

## 6. Métricas-alvo (a medir no emulador Android 4.4)

| Métrica | Meta | Como medir |
|---|---|---|
| Tamanho APK | < 5 MB | `ls -la app.apk` |
| RAM idle (só serviço começou) | < 20 MB | `adb shell dumpsys meminfo` |
| RAM com 100 conexões ativas | < 50 MB | idem sob carga |
| CPU idle (nada a fazer) | < 1% | `adb shell top -m 5` |
| CPU under 10 Mbps throughput | < 15% TV Box RK3226 | idem |
| Latência adicionada (round trip) | < 5 ms | `iperf3` via WS vs direto |
| Boot até "Online no painel" | < 8 s | Cronometrar do start app |
| Conexões simultâneas suportadas | 200+ sem OOM | `wrk -c200` |
| Bateria (TV Box Samsung Galaxy S3) | < 5%/hora idle | `adb shell dumpsys batterystats` |
| Streams de vídeo via túnel | ~95% do link | iperf via SOCKS5 vs direto |

## 7. O que **NÃO** está no escopo do Legacy

- Push notifications FCM (precisaria Play Services).
- Atualização por app store manual via `/api/apk/legacy-version` com `DownloadManager` (ver 07).
- Logout remoto coordenado (pode usar `/api/admin/nodes/[id]` POST kick — ver `broker/main.go:43-49`).
- TLS pinning (não há CA configurada em Android 4.x sem X509 trust manager — apenas padrão sistema).
- Suporte a Android Wear, Android Things, Auto.
- UI dark/light modern — só tema Holo (Android 4.x) ou Material (Android 5+).

## 8. Próximo passo

→ Vá para [02-setup-toolchain.md](./02-setup-toolchain.md) para subir o ambiente de build dentro do Docker (sem instalar nada na sua máquina).
