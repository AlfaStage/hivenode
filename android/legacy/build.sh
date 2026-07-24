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

echo "==> 2. Atualizar jniLibs"
unzip -o -q "$WORKDIR/android-app/app/libs/libhivenode.aar" \
    "jni/*" -d /tmp/aar-extract
mkdir -p "$WORKDIR/android-app/app/src/main/jniLibs"
cp -r /tmp/aar-extract/jni/armeabi-v7a    "$WORKDIR/android-app/app/src/main/jniLibs/" || true
cp -r /tmp/aar-extract/jni/arm64-v8a      "$WORKDIR/android-app/app/src/main/jniLibs/" || true
cp -r /tmp/aar-extract/jni/x86            "$WORKDIR/android-app/app/src/main/jniLibs/" || true
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
