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
