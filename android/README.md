# Aplicativo Android Cliente (O Nó)

Este diretório contém o projeto do aplicativo cliente focado na plataforma Android.

## Responsabilidades:
- Funcionar como um "worker" (nó) recebendo tráfego do Broker Go.
- Manter conexão WebSocket/gRPC persistente.
- Executar resolução de DNS localmente (SOCKS5h) usando o IP da rede móvel (4G/5G) ou Wi-Fi.
- Repassar o tráfego recebido para a internet.
- Operar em segundo plano utilizando recursos nativos (Foreground Service, WakeLock) e ignorando otimizações de bateria agressivas para evitar ser encerrado pelo sistema operacional.

## Tecnologias/Ambiente Previsto:
- Kotlin Nativo (ou Flutter, de acordo com as definições futuras).
- Binário Go embutido (ex: `gomobile` ou lib tuneladora como Chisel/FRP modificado) atuando como o motor de rede no aparelho.
