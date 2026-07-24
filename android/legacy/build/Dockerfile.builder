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
