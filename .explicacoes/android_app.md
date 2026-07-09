# App Android (Tunnel Node)

## Tecnologias
- React Native (Expo SDK 57)
- `react-native-tcp-socket` para interceptação de dados de rede
- WebSockets para sincronização persistente com o Broker

## Fluxo da Ponte TCP
O celular do usuário deixa de atuar apenas como "cliente" e passa a ser o meio da rede (Worker SOCKS5):
1. O usuário aciona "Iniciar Tunnel" no App.
2. O App abre um WebSocket na URL `ws://10.0.2.2:10001/tunnel?nodeId=123`.
3. O Broker Go avisa via WebSocket (`type: CONNECT`) que o usuário do navegador quer acessar um IP e porta (ex: Google).
4. O App Android abre o socket nativo (via rede 4G ou Wi-Fi do aparelho) para o Google.
5. Quando o Google responde, o App intercepta o buffer TCP, empacota em um JSON Base64 (`type: DATA`), envia no WebSocket para o Broker Go, e o Broker entrega pro Navegador SOCKS5!
