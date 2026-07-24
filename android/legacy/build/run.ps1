# Roda build dentro do container. Usa $PWD como workspace.
docker run --rm -it -v "${PWD}:/workspace" -v hivenode_legacy_gradle_cache:/root/.gradle -v hivenode_legacy_go_cache:/root/go/pkg/mod hivenode/legacy-builder:latest @args
