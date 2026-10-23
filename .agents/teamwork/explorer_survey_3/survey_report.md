# Relatório Técnico de Auditoria Arquitetural e Levantamento de Defeitos
## Componentes: `hiveminer-app`, `hivenode-app` e `hivedocker`

**Data:** 2026-10-20  
**Auditor:** Explorer Survey 3 (Technical Audit Subagent)  
**Status do Repositório:** Somente Leitura (Read-Only Investigation) — Nenhuma alteração aplicada no código-fonte.

---

## 1. Sumário Executivo & Mapeamento de Escopo

O ecossistema HiveNode compreende três aplicações clientes com responsabilidades complementares de fornecimento de largura de banda e capacidade de proxy:

1. **`hivedocker/`**: Daemon cliente em Node.js (v20+) conteinerizado via Docker Alpine (`node:22-alpine`), destinado a servidores, VPSs e ambientes Linux/Windows com Docker. Atua como nó de datacenter/servidor estabelecendo túnel TCP reverso autenticado via WebSocket com o `broker` Go e provendo painel web local em porta `8080` protegido por Bearer token.
2. **`hivenode-app/`**: Aplicativo móvel (Android/iOS) desenvolvido em Expo SDK 54 / React Native 0.81.5 configurado como nó de rede privada (`visibility: PRIVATE`). Contém projeto Android nativo pré-gerado (`android/`), integração com `@notifee/react-native` para execução contínua em segundo plano via Foreground Service (`dataSync`), e suporte a leitura de QR Code.
3. **`hiveminer-app/`**: Aplicativo móvel focado em nós públicos de mineração/recompensas (`visibility: PUBLIC`), desenvolvido em Expo SDK 54 / React Native 0.81.5 em modo gerenciado (managed workflow). Possui gamificação com contadores de pontos minerados ($HIVE Points) e tráfego em GB, operando túnel TCP reverso com o `broker`.

A inspeção estática aprofundada revelou **18 defeitos e inconformidades**, abrangendo desde falhas impeditivas de compilação nativa e encerramento prematuro de serviços em segundo plano no Android 14+, até condições de corrida em cancelamento de conexões TCP, ausência de contrapressão de rede (risco de estouro de memória/OOM) e descontinuidade no tratamento de revogação de nós.

---

## 2. Mapeamento Arquitetural, Dependências e Pontos de Entrada

### 2.1 `hivedocker/`
- **Ponto de Entrada**: `server.js` (executado via `npm start` -> `node server.js`).
- **Framework/Bibliotecas**:
  - `express`: `^4.18.2` (servidor HTTP para API local e painel estático).
  - `ws`: `^8.16.0` (conexão de túnel reverso com o broker).
  - `crypto-js`: `^4.2.0` (declarado no `package.json`, porém **não utilizado**).
- **Conteinerização**:
  - `Dockerfile`: Imagem base `node:22-alpine`, porta 8080 exposta, usuário sem privilégios `node`, volume `/app/data`.
  - `docker-compose.yml`: Serviço `hivedocker`, mapeamento `127.0.0.1:8080:8080`, volume nomeado `hivedocker_data:/app/data`, variáveis `PANEL_TOKEN`, `WEB_BASE`, `BROKER_URL`, `NODE_VISIBILITY`.
- **Validação de Segurança**: `hostValidator.js` resolve DNS de destinos e bloqueia faixas privadas/locais IPv4 e IPv6 antes da abertura do socket.
- **Painel Web Local**: `public/index.html` (SPA HTML/JS puro comunicando via `/api/*`).
- **Resumo de Arquivos**: 11 arquivos no total, incluindo script legado `unescape.js` e suite de testes `server.test.js`.

### 2.2 `hivenode-app/`
- **Ponto de Entrada**: `src/app/index.tsx` (via `expo-router/entry`).
- **Framework/Bibliotecas**:
  - Expo SDK: `~54.0.37`.
  - React / React Native: `19.1.0` / `0.81.5`.
  - Rede Nativa: `react-native-tcp-socket` (`^6.4.1`).
  - Segundo Plano: `@notifee/react-native` (`^9.1.8`).
  - Criptografia: `@noble/hashes` (`^1.8.0`), `expo-crypto` (`~15.0.9`), `expo-secure-store` (`~15.0.8`).
  - Animação e Layout: `react-native-reanimated` (`~4.1.1`), `react-native-worklets` (`0.5.1`), `@shopify/flash-list` (`2.0.2`).
- **Estrutura Nativa**: Diretório `android/` com Gradle 8.14.3, Kotlin, CMake/Ninja e Hermes habilitado. Configurado com New Architecture ativada (`newArchEnabled=true` em `gradle.properties`).
- **Config Plugins**: `plugins/withNotifeeForegroundServiceType.js` (ajusta o `ForegroundService` no `AndroidManifest.xml` para `dataSync`).

### 2.3 `hiveminer-app/`
- **Ponto de Entrada**: `src/app/index.tsx` (via `expo-router/entry`).
- **Framework/Bibliotecas**:
  - Expo SDK: `~54.0.36`.
  - React / React Native: `19.1.0` / `0.81.5`.
  - Rede Nativa: `react-native-tcp-socket` (`^6.4.1`).
  - Dependências não utilizadas: `@expo/ui` (`~0.2.0-beta.9`), `@types/crypto-js` (`^4.2.2`).
  - Dependência ausente: falta `react-native-worklets` exigida por `react-native-reanimated` ~4.1.1.
- **Modo de Build**: Managed workflow (sem pasta `android/` versionada), gerando manifesto e código nativo via Expo Prebuild.

---

## 3. Comunicação Inter-Processos e Protocolo de Rede

### 3.1 Handshake do Túnel WebSocket com o Broker Go
Todos os três clientes autenticam-se no Broker Go (`/tunnel`) através de HMAC-SHA256:
- **URL**: `wss://<brokerHost>/tunnel?nodeId=<nodeId>&ts=<unix_timestamp>&sig=<hmac_hex>`
- **Assinatura**: `HMAC_SHA256(tunnelSecret, "<nodeId>:<timestamp>")`
- **Validação no Broker**: O Broker repassa `nodeId`, `sig` e `ts` para a API interna do Next.js em `POST /api/internal/node-auth`.

### 3.2 Protocolo de Enquadramento de Dados do Broker
A comunicação no túnel intercala mensagens em modo Texto (JSON) e Binário:
1. **Controle (JSON)**:
   - `DIAL` (Broker -> Cliente): `{ "type": "DIAL", "connId": "<uuid>", "host": "<target:port>" }`
   - `DIAL_OK` (Cliente -> Broker): `{ "type": "DIAL_OK", "connId": "<uuid>" }`
   - `DIAL_ERR` (Cliente -> Broker): `{ "type": "DIAL_ERR", "connId": "<uuid>" }`
   - `CLOSE` (Bidirecional): `{ "type": "CLOSE", "connId": "<uuid>" }`
   - `PING` (Cliente -> Broker): `{ "type": "PING" }` (renova deadline de 75s no Broker)
   - `TELEMETRY` (Cliente -> Broker): `{ "type": "TELEMETRY", "network": "...", "battery": 1.0, "uptime": 120 }`
   - `NODE_RENAMED` (Broker -> Cliente): `{ "type": "NODE_RENAMED", "newName": "..." }`
   - Encerramento pelo Servidor: `CloseMessage` com código 1000 e payload `"KICKED"`.
2. **Tráfego de Dados TCP Puro (Binário)**:
   - Byte 0: `idLen` (tamanho em bytes do `connId`, 1 a 64).
   - Bytes 1 a `idLen`: String do `connId`.
   - Bytes `1+idLen` em diante: Dados brutos TCP (payload).

---

## 4. Catálogo Detalhado de Defeitos e Vulnerabilidades

### Defeito D01 — [Crítico] [hiveminer-app] Encerramento Compulsório do Serviço em Segundo Plano no Android 14+ (Ausência de Config Plugin do Notifee)
- **Arquivo**: `c:\Users\theja\HiveNode\hiveminer-app\app.json`, linhas 35-52
- **Causa Raiz**: O AAR da biblioteca `@notifee/react-native` declara o serviço de segundo plano no manifesto nativo como `android:foregroundServiceType="shortService"`. No Android 14+ (API 34) e Android 15, `shortService` possui limite rígido de execução de ~3 minutos; ultrapassado esse tempo, o sistema operacional invoca `onTimeout()` e encerra o processo com a exceção `ForegroundServiceDidNotStopInTimeException`. Enquanto o `hivenode-app` implementou o plugin `withNotifeeForegroundServiceType.js` e o registrou no `app.json` (sobrescrevendo o tipo para `dataSync`), o `hiveminer-app` não possui o plugin nem a declaração, inviabilizando a mineração contínua em segundo plano em dispositivos modernos.
- **Evidência Objetiva**:
  - `hivenode-app/plugins/withNotifeeForegroundServiceType.js`:
    ```javascript
    const attrs = {
      'android:name': SERVICE_NAME,
      'android:exported': 'false',
      'android:foregroundServiceType': 'dataSync',
      'tools:replace': 'android:foregroundServiceType',
    };
    ```
  - `hiveminer-app/app.json`: O array `"plugins"` (linhas 35-52) omite totalmente qualquer plugin de foreground service.
- **Impacto**: Usuários que instalam o APK do `hiveminer-app` em aparelhos com Android 14 ou superior sofrem interrupção e encerramento fatal do aplicativo 3 minutos após o bloqueio de tela.

---

### Defeito D02 — [Alto] [hiveminer-app] Permissão `POST_NOTIFICATIONS` Ausente no Manifesto do App
- **Arquivo**: `c:\Users\theja\HiveNode\hiveminer-app\app.json`, linhas 16-22
- **Causa Raiz**: A partir do Android 13 (API level 33), a exibição de notificações fixas obrigatórias para Foreground Services (`notifee.displayNotification({ asForegroundService: true })`) exige expressamente a permissão `android.permission.POST_NOTIFICATIONS` declarada no `AndroidManifest.xml` e solicitada em tempo de execução. O `hivenode-app/app.json` declara a permissão na linha 20, porém o `hiveminer-app/app.json` lista apenas:
  ```json
  "permissions": [
    "android.permission.INTERNET",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
    "android.permission.WAKE_LOCK",
    "android.permission.CAMERA"
  ]
  ```
- **Impacto**: No Android 13+, a notificação do serviço de fundo não é criada ou é rejeitada pelo sistema, fazendo com que o Notifee não consiga blindar a execução em segundo plano contra o coletor de memória do sistema operacional.

---

### Defeito D03 — [Crítico] [hiveminer-app] Falta da Dependência Obrigatória `react-native-worklets` para `react-native-reanimated` 4.x
- **Arquivo**: `c:\Users\theja\HiveNode\hiveminer-app\package.json`, linhas 34-35
- **Causa Raiz**: O `hiveminer-app` especifica `"react-native-reanimated": "~4.1.1"`. A versão 4.x da biblioteca Reanimated exige como peer dependency obrigatória o pacote `react-native-worklets` (adicionado no `hivenode-app/package.json` linha 39 como `"react-native-worklets": "0.5.1"`). Sem essa dependência, o empacotamento Metro ou a compilação C++ do CMake falha ao não encontrar os headers ou módulos de runtime de worklets.
- **Impacto**: Falha de compilação ou quebra imediata na inicialização do aplicativo em ambiente de desenvolvimento e builds de produção.

---

### Defeito D04 — [Alto] [hiveminer-app] Falha de Gerenciamento de Estado após Revogação do Nó (`KICKED`)
- **Arquivo**: `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx`, linhas 724-729
- **Causa Raiz**: Quando um nó é removido ou banido no Painel Web, o Broker Go fecha o túnel com o motivo `KICKED`. No `hivenode-app` (linhas 720-728), a função `forceLogout()` é executada, limpando `AsyncStorage`, `SecureStore`, `nodeId`, `tunnelSecret` e reconduzindo a interface para a tela de autenticação. No `hiveminer-app`:
  ```typescript
  if (e.reason === "KICKED") {
    intentionalLogout.current = true;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    Alert.alert("Acesso interrompido", "Verifique o estado do aparelho no painel.");
    return;
  }
  ```
  A função `forceLogout()` não existe no `hiveminer-app`. Nenhuma credencial é apagada. O estado `nodeId` permanece preenchido na tela principal.
- **Impacto**: O usuário continua preso na tela principal com a placa revogada. Ao reiniciar o app ou religar a conexão, o aplicativo tenta reconectar usando as credenciais revogadas, falhando continuamente sem permitir novo escaneamento de QR Code a menos que o usuário clique manualmente em "Desvincular".

---

### Defeito D05 — [Médio] [hiveminer-app] Tentativa Prematura de Conexão no Boot por Falta de Flag `sessionLoaded`
- **Arquivo**: `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx`, linhas 152-167
- **Causa Raiz**: O ouvinte de rede `NetInfo.addEventListener` dispara seu callback imediatamente na montagem do componente informando o status de conectividade atual. No `hivenode-app`, foi introduzida a referência `sessionLoaded.current` para bloquear conexões antes do término de `loadSession()`. No `hiveminer-app`, `connectRef.current()` é invocado antes que `AsyncStorage` e `SecureStore` terminem a leitura assíncrona. Como `serverIp`, `nodeId` e `tunnelSecret` ainda estão vazios, `connectToBroker()` aborta precocemente.
- **Impacto**: Na inicialização do app com conexão de rede ativa e sessão gravada, a reconexão automática falha no primeiro milissegundo e não é reativada ao concluir o carregamento da sessão, exigindo toque manual no botão "Ligar Antena Web3".

---

### Defeito D06 — [Alto] [hiveminer-app & hivenode-app] Condição de Corrida e Desincronização de Protocolo entre `CLOSE` e `DIAL` Pendente
- **Arquivos**:
  - `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx`, linhas 644-650 & 697-704
  - `c:\Users\theja\HiveNode\hivenode-app\src\app\index.tsx`, linhas 640-646 & 694-701
- **Causa Raiz**: Quando o Broker envia uma solicitação de discagem TCP (`DIAL`), o cliente inicia a conexão assíncrona via `TcpSocket.createConnection`. Se o cliente web ou broker abortar a requisição antes do handshake TCP finalizar, o Broker envia `{ type: "CLOSE", connId }`. O bloco `type === "CLOSE"` destrói o socket e o remove de `activeSockets[connId]`. No entanto, quando o handshake TCP finalmente termina, o callback de conexão do `TcpSocket.createConnection` é disparado:
  ```typescript
  const client = TcpSocket.createConnection({ port: targetPort, host: targetHost, connectTimeout: 10000 }, () => {
    if (ws.current !== socket || intentionalLogout.current || !client.remoteAddress || !isHostSafe(client.remoteAddress)) {
      client.destroy(); send(JSON.stringify({ connId, type: "DIAL_ERR" })); return;
    }
    // Confirma pro Go que o TCP abriu, liberando o SOCKS5
    send(JSON.stringify({ connId, type: "DIAL_OK" }));
  });
  ```
  O callback **não valida** se `activeSockets[connId]` ainda existe ou se foi cancelado por um `CLOSE` prévio. Ele envia `DIAL_OK` ao Broker para um fluxo que já foi cancelado.
- **Impacto**: O Broker Go recebe `DIAL_OK` fora de ordem ou em stream já fechado, desestabilizando o gerenciador de túneis e causando logs anômalos ou conexões fantasmas.

---

### Defeito D07 — [Médio] [hiveminer-app & hivenode-app] Envio Redundante de `CLOSE` em Loop de Eco na Finalização de Stream
- **Arquivos**:
  - `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx`, linhas 686-689 e 697-704
  - `c:\Users\theja\HiveNode\hivenode-app\src\app\index.tsx`, linhas 682-685 e 694-701
- **Causa Raiz**: Quando o Broker fecha um stream enviando `{ type: "CLOSE", connId }`, o cliente executa `activeSockets[connId].destroy()`. O método `destroy()` emite o evento nativo `"close"` do socket, onde o código cliente registra:
  ```typescript
  client.on("close", () => {
    send(JSON.stringify({ connId, type: "CLOSE" }));
    delete activeSockets[connId];
  });
  ```
  Isso faz o cliente enviar uma mensagem `CLOSE` de volta ao Broker para um stream que o próprio Broker solicitou encerramento.
- **Impacto**: Tráfego desnecessário de pacotes JSON no WebSocket do broker em cada encerramento de conexão proxy/túnel.

---

### Defeito D08 — [Crítico] [hiveminer-app & hivenode-app] Ausência de Contrapressão de Rede (Backpressure) com Risco de Out-of-Memory (OOM)
- **Arquivos**:
  - `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx`, linhas 608-611 & 652-678
  - `c:\Users\theja\HiveNode\hivenode-app\src\app\index.tsx`, linhas 604-607 & 648-674
- **Causa Raiz**:
  - Na direção **TCP -> WebSocket**: Em `client.on("data", bufferData)`, `send(outBuffer)` é invocado incondicionalmente sem checagem de `ws.bufferedAmount`. No `hivedocker/server.js`, existe o circuit breaker:
    `if (ws.bufferedAmount > 1048576) { socket.destroy(); return; }`
  - Na direção **WebSocket -> TCP**: Ao receber pacotes binários do Broker, o cliente executa `activeSockets[connId].write(payload)` sem pausar o WebSocket caso o buffer de escrita do TCP esteja saturado (no `hivedocker`, há `if (socket.writableLength > 1048576) socket.destroy()`).
- **Impacto**: Em transferências de alta taxa de dados (downloads de vídeos ou arquivos pesados via proxy), a fila de memória do motor React Native / JavaScript acumula centenas de megabytes em instantes, resultando em travamento da thread de UI e encerramento abrupto do aplicativo pelo OOM Killer do Android.

---

### Defeito D09 — [Médio] [hiveminer-app & hivenode-app] Risco de Corrupção Binária na Conversão de Payload TCP de String
- **Arquivos**:
  - `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx`, linhas 659-663
  - `c:\Users\theja\HiveNode\hivenode-app\src\app\index.tsx`, linhas 655-659
- **Causa Raiz**: O fallback de deserialização do evento `data` do socket TCP trata strings da seguinte forma:
  ```typescript
  } else if (typeof bufferData === "string") {
    const arr = new Uint8Array(bufferData.length);
    for (let i = 0; i < bufferData.length; i++) arr[i] = bufferData.charCodeAt(i);
    payloadBytes = arr;
  }
  ```
  `charCodeAt(i)` opera sobre unidades de código UTF-16 de 16 bits. Se a bridge retornar strings com caracteres multibyte UTF-8 codificados além de ASCII ou bytes acima de 127, a conversão direta trunca os dados, corrompendo pacotes de protocolos binários como TLS (HTTPS) e HTTP/2.
- **Impacto**: Conexões HTTPS tuneladas sofrem falha de handshake TLS com `bad record MAC` ou `protocol error`.

---

### Defeito D10 — [Baixo] [hiveminer-app] Rejeição de Promessa Não Tratada em `SplashScreen`
- **Arquivo**: `c:\Users\theja\HiveNode\hiveminer-app\src\app\_layout.tsx`, linha 6
- **Causa Raiz**: Execução síncrona sem captura de erro:
  `SplashScreen.preventAutoHideAsync();`
  No `hivenode-app/src/app/_layout.tsx` (linha 6), a chamada é devidamente protegida com `SplashScreen.preventAutoHideAsync().catch(() => {});`. Em recarregamentos de desenvolvimento (Fast Refresh) ou em ambiente web, a promessa rejeita caso a splash screen já tenha sido travada, gerando `Unhandled Promise Rejection`.
- **Impacto**: Alertas de erro não capturado e poluição dos logs de runtime.

---

### Defeito D11 — [Baixo] [hiveminer-app] IP de Servidor Hardcoded na Função de Registro Manual
- **Arquivo**: `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx`, linha 422
- **Causa Raiz**:
  `const targetServer = "api.hivenode.alfastage.com.br";`
  Diferente do `hivenode-app` que utiliza a constante `BROKER_HOST`, o minerador fixou uma string literal com o subdomínio da infraestrutura de staging.
- **Impacto**: Quebra da capacidade de redirecionar o aplicativo para instâncias locais ou de homologação através de variáveis de configuração em `app.json`.

---

### Defeito D12 — [Baixo] [hiveminer-app & hivenode-app] Falta de `estimatedItemSize` no Componente `FlashList`
- **Arquivos**:
  - `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx`, linhas 944-954
  - `c:\Users\theja\HiveNode\hivenode-app\src\app\index.tsx`, linhas 970-980
- **Causa Raiz**: O componente `@shopify/flash-list` exige a propriedade `estimatedItemSize` para estimar e reciclar células de tela com alto desempenho. Ambas as telas renderizam `<FlashList data={logs} ... />` sem fornecer essa propriedade.
- **Impacto**: Disparo contínuo de advertências (`console.warn`) no console e degradação de desempenho na rolagem de logs.

---

### Defeito D13 — [Médio] [hivenode-app] Incompatibilidade do Scanner de QR Code com o Prefixo `hiveminer|`
- **Arquivo**: `c:\Users\theja\HiveNode\hivenode-app\src\app\index.tsx`, linha 236
- **Causa Raiz**: No `hiveminer-app` (linha 247), o parser aceita tanto `hiveminer|` quanto `hivenode|`:
  `if (data.startsWith("hiveminer|") || data.startsWith("hivenode|"))`
  No `hivenode-app` (linha 236), apenas `hivenode|` é aceito:
  `if (data.startsWith("hivenode|"))`
- **Impacto**: Aparelhos rodando o cliente `hivenode-app` rejeitam QR Codes do painel emitidos sob a tag de minerador, exibindo mensagem de formato inválido.

---

### Defeito D14 — [Alto] [hiveminer-app & hivenode-app] Fragilidade e Falha de Plataforma no Script `scripts/harden-tcp.cjs`
- **Arquivos**:
  - `c:\Users\theja\HiveNode\hiveminer-app\scripts\harden-tcp.cjs`, linhas 1-12
  - `c:\Users\theja\HiveNode\hivenode-app\scripts\harden-tcp.cjs`, linhas 1-12
- **Causa Raiz**:
  1. O script é executado no hook `"postinstall": "node scripts/harden-tcp.cjs"`. Ele lê diretamente `node_modules/react-native-tcp-socket/android/src/main/java/com/asterinet/react/tcpsocket/TcpSocketClient.java`. Se o pacote for instalado em ambiente isolado ou cache limpo sem a estrutura de diretórios esperada, o script aborta a instalação com `ENOENT`.
  2. O script remenda **apenas o arquivo Java do Android**. O arquivo nativo do iOS (`ios/TcpSocketClient.m`) **não recebe nenhum patch**. Assim, em builds iOS, a checagem nativa de IP privado antes da discagem é completamente inexistente.
- **Impacto**: Falha de compilação em ambientes de CI limpos e bypass total da política de segurança de rede local em clientes Apple iOS.

---

### Defeito D15 — [Médio] [hivedocker] Dependência Não Utilizada `crypto-js`
- **Arquivo**: `c:\Users\theja\HiveNode\hivedocker\package.json`, linha 16
- **Causa Raiz**: O pacote `"crypto-js": "^4.2.0"` está listado em `dependencies`. Todo o código de hashing HMAC e geração de identificadores em `server.js` e `hostValidator.js` utiliza exclusivamente a biblioteca nativa do Node.js `node:crypto`.
- **Impacto**: Aumento desnecessário do tamanho da imagem Docker e superfície de vulnerabilidade para supply-chain attacks sem nenhum benefício funcional.

---

### Defeito D16 — [Médio] [hivedocker] Incompatibilidade do `fs.renameSync` em Sistemas Windows Nativos
- **Arquivo**: `c:\Users\theja\HiveNode\hivedocker\server.js`, linha 23
- **Causa Raiz**: O método `save()` grava a configuração de forma atômica no Linux:
  ```javascript
  fs.writeFileSync(`${configFile}.tmp`, JSON.stringify(config), { mode: 0o600 });
  fs.renameSync(`${configFile}.tmp`, configFile);
  ```
  No Windows (caso o `server.js` seja executado fora do container nativamente), a API Win32 `MoveFileEx` chamada pelo `fs.renameSync` falha com `EPERM` ou `EBUSY` se o arquivo de destino já existir e estiver com descritor aberto por processos de telemetria ou indexadores do sistema.
- **Impacto**: Erro fatal ao tentar atualizar `config.json` em execuções de desenvolvimento local em ambiente Windows.

---

### Defeito D17 — [Baixo] [hivedocker] Script de Depuração Abandonado no Repositório (`unescape.js`)
- **Arquivo**: `c:\Users\theja\HiveNode\hivedocker\unescape.js`, linhas 1-6
- **Causa Raiz**: Script utilitário temporário de substituição de template literals:
  ```javascript
  const fs = require('fs');
  let code = fs.readFileSync('server.js', 'utf8');
  code = code.replace(/\\`/g, '`');
  code = code.replace(/\\\${/g, '${');
  fs.writeFileSync('server.js', code);
  ```
- **Impacto**: Código morto mantido no repositório de produção.

---

### Defeito D18 — [Baixo] [hivenode-app & Raiz] Acúmulo de Arquivos Binários e Dumps de Log de Build do EAS
- **Arquivos**:
  - `c:\Users\theja\HiveNode\hivenode-app\eas_build_error.log` (280 KB)
  - `c:\Users\theja\HiveNode\hivenode-app\build_log.txt` (binário)
  - `c:\Users\theja\HiveNode\hivenode-app\decompressed_log.txt` (7 bytes)
  - `c:\Users\theja\HiveNode\hivenode-app\eas_view_1.log` até `eas_view_7.log`
  - `c:\Users\theja\HiveNode\eas-build.log` e `eas-build.txt` (raiz do projeto, 31 KB)
- **Causa Raiz**: Dumps de erro de compilações passadas do EAS Build e arquivos comprimidos foram versionados ou deixados na árvore de trabalho sem inclusão no `.gitignore`.
- **Impacto**: Poluição do repositório Git, aumento do tempo de clone e risco de exposição de tokens do EAS ou variáveis de ambiente registradas nos cabeçalhos de build.

---

## 5. Matriz de Reconciliação e Análise Comparativa

A tabela abaixo sintetiza o comportamento e as diferenças arquiteturais entre os três clientes:

| Funcionalidade / Mecanismo | `hivedocker` | `hivenode-app` | `hiveminer-app` |
| :--- | :--- | :--- | :--- |
| **Plataforma Alvo** | Servidores / Docker (Linux/Win) | Celular Android (e iOS) | Celular Android (e iOS) |
| **Visibilidade Padrão** | `PUBLIC` ou `PRIVATE` (via ENV) | `PRIVATE` | `PUBLIC` |
| **Tipo de Conexão Broker** | WebSocket Client (`ws`) | WebSocket Client (RN nativo) | WebSocket Client (RN nativo) |
| **Enquadramento TCP** | Buffer `[idLen, ...id, ...payload]` | `Uint8Array` manual | `Uint8Array` manual |
| **Tratamento de Contrapressão** | Sim (`bufferedAmount` / `writableLength`) | **Não** (Risco de OOM) | **Não** (Risco de OOM) |
| **Validação SSRF** | Pré-discagem via DNS (`resolveTarget`) | Pós-conexão (`client.remoteAddress`) + patch Java | Pós-conexão (`client.remoteAddress`) + patch Java |
| **Proteção Android 14+** | N/A (Docker) | **Sim** (`withNotifeeForegroundServiceType`) | **Não** (Derrubado em 3 min) |
| **Permissão POST_NOTIFICATIONS**| N/A | **Sim** | **Não** (Falta no `app.json`) |
| **Tratamento de `KICKED`** | Pausa reconexão; preserva token | **Sim** (`forceLogout` completo) | **Não** (Falta `forceLogout`) |
| **Gamificação ($HIVE Points)** | Não | Não | **Sim** (Polling de `/api/auth/me`) |
| **Pareamento Inicial** | Device Code Flow (`/auth/device-code`) | QR Code (`/auth/qr-login`) + Login | QR Code (`/auth/qr-login`) + Login |

---

## 6. Verificação e Diagnóstico

Para verificação estática independente dos defeitos apontados neste relatório:

1. **Inspeção do Plugin Notifee em hiveminer-app**:
   - Comparar `c:\Users\theja\HiveNode\hivenode-app\app.json` (linha 60) com `c:\Users\theja\HiveNode\hiveminer-app\app.json`. Constatar a ausência de `withNotifeeForegroundServiceType` e da pasta `plugins/` em `hiveminer-app`.
2. **Inspeção de Permissões Android**:
   - Observar a chave `"permissions"` em `hiveminer-app/app.json` (linhas 16-22) comprovando a ausência de `"android.permission.POST_NOTIFICATIONS"`.
3. **Inspeção de Desconexão Forçada (`forceLogout`)**:
   - Pesquisar `forceLogout` em `hiveminer-app/src/app/index.tsx` (0 resultados) vs `hivenode-app/src/app/index.tsx` (linhas 436-449).
4. **Inspeção de Dependências Reanimated**:
   - Comparar a presença de `react-native-worklets` em `hivenode-app/package.json` (linha 39) e sua ausência em `hiveminer-app/package.json`.
5. **Inspeção de Backpressure**:
   - Contrastar linhas 60 e 82 de `hivedocker/server.js` com o fluxo de dados em `index.tsx` de ambos os aplicativos móveis.
