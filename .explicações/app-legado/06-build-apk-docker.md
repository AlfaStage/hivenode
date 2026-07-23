# 06 — Build APK assinado (via Docker)

> Receita completa para gerar `hivenode-legacy.apk` assinado e pronto para sideload. Tudo no Docker — nada de JDK/SDK no seu PC.

## 0. Visão geral do pipeline

```
[Container hivenode/legacy-builder]
├── 1. gomobile bind           → native-go/... → app/libs/libhivenode.aar
├── 2. copiar .so p/ jniLibs    → empacotados no APK
├── 3. gradle assembleRelease   → app/build/outputs/apk/release/app-release.apk
├── 4. zipalign                 → app-release-aligned.apk
└── 5. apksigner                → hivenode-legacy-<version>.apk (assinado)
```

## 1. Keystore (uma única vez)

Antes de buildar, gere sua keystore de assinatura. O mesmo keystore deve ser usado em todas as versões p/ permitir updates automáticos (Android recusa instalação com signature diferente).

### Dentro do container (uma única vez)

```bash
mkdir -p /workspace/android/legacy/signing
cd /workspace/android/legacy/signing
keytool -genkey -v \
    -keystore legacy.keystore \
    -alias hivenode-legacy \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass hivenode -keypass hivenode \
    -dname "CN=HiveNode Legacy, OU=Dev, O=Alfastage, L=Campinas, ST=SP, C=BR"
ls legacy.keystore
# SUCESSO: legacy.keystore ~5 KB
```

> **Backupe este arquivo!** Perder = impossível de fazer update nos aparelhos já instalados.

### Backup

```bash
# Sair do container e copiar o keystore:
# host: C:\Users\theja\HiveNode\android\legacy\signing\legacy.keystore
# Verificar:
docker run --rm -v "${PWD}:/workspace" alpine ls -la /workspace/android/legacy/signing/
```

⚠️ Adicione `legacy.keystore` ao `.gitignore`:
```
android/legacy/signing/legacy.keystore
```

## 2. Script de build

Crie `android/legacy/build.sh` (Linux, dentro do container) orquestre todo passo:

```bash
#!/bin/bash
set -euo pipefail

WORKDIR="${1:-/workspace/android/legacy}"
cd "$WORKDIR"

echo "==> 1. gomobile bind (gera AAR com .so dentro)"
cd native-go
go mod tidy
gomobile bind \
    -target=android/arm,android/arm64,android/386 \
    -androidapi=16 \
    -javapkg=br.alfastage.hivenode.legacy \
    -o "$WORKDIR/android-app/app/libs/libhivenode.aar" \
    ./mobile

echo "==> 2. Atualizar jniLibs (necessário p/ AGP 3.0.1 que não extrai .so do AAR automagicamente)"
unzip -o -q "$WORKDIR/android-app/app/libs/libhivenode.aar" \
    "jni/*" -d /tmp/aar-extract
mkdir -p "$WORKDIR/android-app/app/src/main/jniLibs"
cp -r /tmp/aar-extract/jni/armeabi-v7a    "$WORKDIR/android-app/app/src/main/jniLibs/"
cp -r /tmp/aar-extract/jni/arm64-v8a      "$WORKDIR/android-app/app/src/main/jniLibs/"
cp -r /tmp/aar-extract/jni/x86            "$WORKDIR/android-app/app/src/main/jniLibs/"
rm -rf /tmp/aar-extract

echo "==> 3. gradle assembleRelease"
cd "$WORKDIR/android-app"
./gradlew assembleRelease --no-daemon

echo "==> 4. zipalign"
ALIGN="/opt/android-sdk/build-tools/28.0.3/zipalign"
APK_IN="$WORKDIR/android-app/app/build/outputs/apk/release/app-release.apk"
APK_ALIGNED="$WORKDIR/app-release-aligned.apk"
"$ALIGN" -f -v 4 "$APK_IN" "$APK_ALIGNED" > /tmp/zipalign.log 2>&1
tail -2 /tmp/zipalign.log

echo "==> 5. apksigner"
SIGN=/opt/android-sdk/build-tools/28.0.3/apksigner
KEYSTORE="$WORKDIR/signing/legacy.keystore"
OUT="$WORKDIR/hivenode-legacy-$(grep versionName app/build.gradle | head -1 | sed -e 's/[^0-9.]//g').apk"
"$SIGN" sign \
    --ks "$KEYSTORE" --ks-key-alias hivenode-legacy \
    --ks-pass pass:hivenode --key-pass pass:hivenode \
    --out "$OUT" "$APK_ALIGNED"

echo "==> verify"
"$SIGN" verify --verbose "$OUT" | head -10

echo "==> SUCESSO!"
ls -lh "$OUT"
```

Tornar executável:
```bash
chmod +x /workspace/android/legacy/build.sh
```

## 3. Runner no host (PowerShell)

Crie `C:\Users\theja\HiveNode\android\legacy\build-apk.ps1`:

```powershell
# Roda build.sh completo dentro do container.
$ErrorActionPreference = "Stop"
$project = "C:\Users\theja\HiveNode"

docker run --rm `
    -v "${project}:/workspace" `
    -v hivenode_legacy_gradle_cache:/root/.gradle `
    -v hivenode_legacy_go_cache:/root/go/pkg/mod `
    -w /workspace/android/legacy `
    hivenode/legacy-builder:latest `
    bash /workspace/android/legacy/build.sh

if ($LASTEXITCODE -eq 0) {
    Write-Host "APK gerado em C:\Users\theja\HiveNode\android\legacy\hivenode-legacy-*.apk" -ForegroundColor Green
    Get-ChildItem "$project\android\legacy\hivenode-legacy-*.apk"
} else {
    Write-Host "BUILD FALHOU - exit $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
```

## 4. Executar o build

No host (Windows):

```powershell
cd C:\Users\theja\HiveNode
.\android\legacy\build-apk.ps1
```

**Tempo esperado**:
- Primeira vez: ~10 min (Go compilação + Gradle + NDK build).
- Após: ~3-5 min (cache Gradle + cache Go module).

## 5. Build de Debug builds para teste rápido

Para um APK mais rápido (não otimizado, sem assinatura necessária), use `assembleDebug`:

```bash
# Dentro do container:
cd /workspace/android/legacy/android-app
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

Debug build já vem auto-assinado com um keystore de debug do Android — bom para instalar em emulador.

## 6. Variantes: HiveMiner Legacy

Para gerar a variante HiveMner, basta:

1. **Duplicar** `android-app/` para `android-app-miner/`.
2. Trocar `applicationId` em `app/build.gradle`:
   ```gradle
   applicationId "br.alfastage.hivenode.miner"
   ```
3. Trocar `app_name` em `strings.xml` para `"Hiveminer Legacy"`.
4. Passar `type="miner"` no device-code/generate.

> Recomendação: use Gradle flavors em vez de duplicar projetos:
> ```gradle
> // android-app/app/build.gradle
> android {
>     flavorDimensions "role"
>     productFlavors {
>         proxy { applicationId "br.alfastage.hivenode.legacy" }
>         miner { applicationId "br.alfastage.hivenode.miner" }
>     }
> }
> ```
> Resultado: 2 APKs (`app-proxy-release.apk` e `app-miner-release.apk`).

## 7. Reduzir tamanho do APK (splitting)

APK "universal" inclui 3 ABIs (~9 MB .so). Para reduzir ~3x:

```gradle
// app/build.gradle - android.defaultConfig
splits {
    abi {
        enable true
        reset()
        include 'armeabi-v7a', 'arm64-v8a', 'x86'
        universalApk true // opcional - mantém um fat
    }
}
```

Gera: `app-armeabi-v7a-release.apk` (3 MB), `app-arm64-v8a-release.apk` (4 MB), `app-x86-release.apk` (4 MB), `app-universal-release.apk` (8 MB).

Distribua o universal para máxima compatibilidade (TV Box varia entre ARM e arm64).

## 8. Publicar no servidor

Para o auto-update funcionar, hospede os APKs em `/web/public`:

```
web/public/apk/
├── hivenode-legacy-1.0.0-proxy-armv7.apk
├── hivenode-legacy-1.0.0-proxy-arm64.apk
└── hivenode-legacy-1.0.0-miner-universal.apk
```

Controle de versão via endpoint documentado em `07-teste-deploy.md`.

## 9. Limpeza periódica

Caches Docker ocupam espaço com o tempo:
```powershell
# Ver tamanho:
docker system df

# Limpeza segura de objetos dangling (não volumes nomeados):
docker system prune -a -f

# Limpar caches Legacy Gradle + Go (raramente necessário, faz re-download):
docker volume rm hivenode_legacy_gradle_cache hivenode_legacy_go_cache
```

## 10. Troubleshooting

### `gomobile bind`: cannot find package "golang.org/x/mobile"
Faltou `go mod tidy`. Dentro do container:
```bash
cd /workspace/android/legacy/native-go
go mod tidy
```

### `gradle`: Could not resolve com.android.tools.build:gradle:3.0.1
- AGP 3.0.1 está no Google Maven, mas Android Studio moderno remove. Confirme que `google()` é o 1º repo:
  ```gradle
  buildscript {
      repositories { google(); jcenter() }
  }
  ```
- Se ainda falhar, jcenter() foi descontinuado em 2022 — tente `maven { url 'https://maven.google.com' }`.

### `zipalign` não encontrado
Caminho exato: `/opt/android-sdk/build-tools/28.0.3/zipalign`. Confirme:
```bash
ls /opt/android-sdk/build-tools/*/zipalign
```

### `apksigner`: Failed to read signer cert
Senha do keystore errada. Configure via env vars no `docker run`:
```powershell
docker run --rm -e LEGACY_KEYSTORE_PASS=sua_senha ... hivenode/legacy-builder
```
E no `build.sh` troque:
```bash
--ks-pass pass:${LEGACY_KEYSTORE_PASS:-hivenode}
```

### APK instalado não conecta ao broker
- Confirme `prefs.getBrokerHost()` em `PrefStore.java` retorna o endereço certo (default `broker.hivenode.alfastage.com.br`).
- Verifique DNS do dispositivo em `Settings > Wifi > DNS`. Alguns Android 4.x não resolvem nomes por padrão.
- Teste com IP direto em `prefs.saveLogin` temporariamente.

### `INSTALL_FAILED_OLDER_SDK`
APK exige API maior que o dispositivo. Verifique `minSdkVersion 16` em `app/build.gradle`. TV box algumas tem Android 4.0.x (API 14/15) — não suportadas.

## 11. Próximo passo

→ [07-teste-deploy.md](./07-teste-deploy.md) para testar em emulador Android 4.4 e fazer sideload em TV Box real.
