#!/bin/bash
docker run --rm -it -v "$PWD:/workspace" \
  -v hivenode_light_gradle_cache:/root/.gradle \
  -v hivenode_light_go_cache:/root/go/pkg/mod \
  hivenode/light-builder:latest "$@"
