# 02 — Setup da Toolchain (via Docker, sem sujar seu PC)

> Veja como ter o ambiente de build completo rodando em Docker. Nada é instalado no seu Windows/Linux. Ao final, você tem uma imagem `hivenode/legacy-builder:latest` capaz de gerar `hivenode-legacy.apk` e uma diretoria de projeto pronta para edit.

## 0. Por que via Docker

Seu PC já está cheio de toolchains (Node 20, Go 1.25 para o broker, NDK do projeto original). Instalar:
- Go 1.21 (legado para gomobile moderno)
- JDK 8
- Android SDK API 22 + Build-Tools 28 + NDK r25c
- Gradle 4.4 + AGP 3.0.1
- gomobile + golang.org/x/mobile

...ocuparia ~5 GB. Docker resolve tudo isolado, descartável e reproduzível.

## 1. Pré-requisitos

### No Windows
- Docker Desktop 4+ instalado e rodando.
- Espaço em disco: 4 GB para imagem.
- 4 GB RAM disponível p/ build (compilação Go + NDK é pesado).

### No Linux/macOS
- Docker 20+ + docker-compose.

Verifique:
```powershell
docker --version
docker run --rm hello-world
```

## 2. Criar a imagem builder

Crie `android/legacy/build/Dockerfile.builder` com:

```dockerfile
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# 1. Base packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip git openjdk-8-jdk \
    build-essential wget xz-utils file \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# 2. Android SDK
ENV ANDROID_HOME=/opt/android-sdk
RUN mkdir -p $ANDROID_HOME && cd $ANDROID_HOME \
    && curl -fsSLO https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip \
    && unzip -q commandlinetools-linux-9477386_latest.zip -d cmdline-tools \
    && rm commandlinetools-linux-9477386_latest.zip \
    && mv cmdline-tools/cmdline-tools cmdline-tools/latest

ENV PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

# yes | sdkmanager --licenses
RUN yes | sdkmanager --licenses > /dev/null 2>&1 || true

# 3. Instalar SDK components fixos p/ o Legado
RUN sdkmanager \
    "platform-tools" \
    "platforms;android-22" \
    "platforms;android-16" \
    "build-tools;28.0.3" \
    "ndk;25.2.9519653"

ENV ANDROID_NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653

# 4. Go 1.21 (versão recomendada p/ gomobile hoje)
ENV GOLANG_VERSION=1.21.13
RUN curl -fsSL https://go.dev/dl/go$GOLANG_VERSION.linux-amd64.tar.gz | tar -C /usr/local -xz
ENV GOPATH=/root/go
ENV PATH=$PATH:/usr/local/go/bin:$GOPATH/bin

# 5. gomobile e init
RUN go install golang.org/x/mobile/cmd/gomobile@latest \
    && gomobile init -v

# 6. Gradle 4.4 (legado, suporta AGP 3.0.1)
ENV GRADLE_VERSION=4.4.1
RUN curl -fsSL https://services.gradle.org/distributions/gradle-$GRADLE_VERSION-bin.zip -o /tmp/gradle.zip \
    && unzip -q /tmp/gradle.zip -d /opt \
    && rm /tmp/gradle.zip
ENV PATH=$PATH:/opt/gradle-$GRADLE_VERSION/bin

# 7. Ferramentas Android SDK extras
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake autoconf libtool pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

SHELL ["/bin/bash", "-c"]
CMD ["/bin/bash"]
```

Construa a imagem:
```powershell
cd C:\Users\theja\HiveNode\android\legacy\build
docker build -f Dockerfile.builder -t hivenode/legacy-builder:latest .
```
Tempo: 8-15 minutos (primeira vez). Tamanho: ~4 GB.

## 3. Script de helper

Crie `android/legacy/build/run.sh` (Linux) e `run.ps1` (Windows) para evitar redo de docker run.

### `run.ps1` (PowerShell)
```powershell
# Roda build dentro do container. Usa $PWD como workspace.
docker run --rm -it -v "${PWD}:/workspace" -v hivenode_legacy_gradle_cache:/root/.gradle -v hivenode_legacy_go_cache:/root/go/pkg/mod hivenode/legacy-builder:latest @args
```

### `run.sh` (Bash)
```bash
#!/bin/bash
docker run --rm -it -v "$PWD:/workspace" \
  -v hivenode_legacy_gradle_cache:/root/.gradle \
  -v hivenode_legacy_go_cache:/root/go/pkg/mod \
  hivenode/legacy-builder:latest "$@"
```

Tornar executável (Linux): `chmod +x run.sh`

## 4. Validar toolchain

Entre no container pela primeira vez:
```powershell
cd C:\Users\theja\HiveNode
.\android\legacy\build\run.ps1
```
Dentro do bash do container:

```bash
# 4.1 Valida Go + gomobile
go version
# esperado: go1.21.13 linux/amd64

gomobile version
# esperado: gomobile version +xxx release

# 4.2 Valida Android SDK
sdkmanager --list_installed | head
# esperado: platform-tools, platforms;android-22, ndk;25.2.9519653 etc.

# 4.3 Valida JDK
javac -version
# esperado: 1.8.0_xxx

# 4.4 Valida Gradle
gradle --version
# esperado: Gradle 4.4.1

# 4.5 Valida ANDROID_NDK_HOME existe
ls $ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android21-clang
# esperado: arquivo existe

# 4.6 Teste de prova: hello-world Go -> APK
mkdir -p /tmp/hello && cd /tmp/hello && \
cat > main.go <<'EOF'
package main

import "golang.org/x/mobile/app"

func main() { app.Main(func(a []byte) {}) }
EOF
go mod init hello.example && go mod tidy
gomobile build -target=android/arm64 -o /tmp/hello.apk ./hello.example
# esperado: /tmp/hello.apk gerado
ls -la /tmp/hello.apk
```

Se `/tmp/hello.apk` existir (alguns MB), tá tudo ok.

## 5. Volumes persistentes

- `hivenode_legacy_gradle_cache` — cache de downloads Gradle (sprime 1 GB). Evita re-download no próximo build.
- `hivenode_legacy_go_cache` — cache de módulos Go (~500 MB).

Para limpar (raramente):
```powershell
docker volume rm hivenode_legacy_gradle_cache hivenode_legacy_go_cache
```

## 6. Debug de problemas comuns

### `permission denied` ao montar volumes no Windows
Use `-v "${PWD}:/workspace"` (com aspas duplas e chaves) ao invés de `-v $(pwd):/workspace` — PowerShell não interpola `$(pwd)`.

### `Cannot find SDK license` ao rodar `sdkmanager`
Falta aceitar licenças. Dentro do container: `yes | sdkmanager --licenses`.

### `gomobile init` falha: NDK not found
Verifique `echo $ANDROID_NDK_HOME` dentro do container. Se vazio, na próxima execução adicione ao seu `run.sh`:
```
-e ANDROID_NDK_HOME=/opt/android-sdk/ndk/25.2.9519653
```

### `dl.google.com` bloqueado (rede corporativa)
Configure proxy HTTP:
```
docker run ... -e HTTP_PROXY=http://meu.proxy:8080 -e HTTPS_PROXY=http://meu.proxy:8080 ...
```

### `aapt2` não encontrado no build Android
Faltam `build-tools;28.0.3` no SDK. Já está no Dockerfile, mas se reinstalou:
```bash
sdkmanager "build-tools;28.0.3"
```

### Sem espaço em disco
A imagem + caches ocupa ~8 GB no Docker. Limpe com `docker system prune -a --volumes` periodicamente (lembrando que perde caches e é preciso re-buildar a imagem).

## 7. Próximo passo

→ Vá para [03-codigo-go.md](./03-codigo-go.md) para implementar o núcleo Go compilado via gomobile.
