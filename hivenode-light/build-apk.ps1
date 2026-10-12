# Roda build.sh completo dentro do container.
$ErrorActionPreference = "Stop"
$project = "C:\Users\theja\HiveNode"

docker run --rm `
    -v "${project}:/workspace" `
    -v hivenode_light_gradle_cache:/root/.gradle `
    -v hivenode_light_go_cache:/root/go/pkg/mod `
    -w /workspace/android/light `
    hivenode/light-builder:latest `
    bash /workspace/android/light/build.sh

if ($LASTEXITCODE -eq 0) {
    Write-Host "APK gerado em C:\Users\theja\HiveNode\android\light\hivenode-light-*.apk" -ForegroundColor Green
    Get-ChildItem "$project\android\light\hivenode-light-*.apk"
} else {
    Write-Host "BUILD FALHOU - exit $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
