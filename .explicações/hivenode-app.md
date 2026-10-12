# HiveNode App — Documentação Técnica

## Visão Geral

App React Native (Expo SDK 54) que atua como **node móvel** do HiveNode, estabelecendo um túnel TCP reverso via WebSocket para o broker em produção (`api.hivenode.alfastage.com.br`).

## Tecnologias

| Pacote | Versão | Função |
|---|---|---|
| Expo | ~54.0.36 | Framework base |
| React Native | 0.81.5 | Runtime móvel |
| expo-router | ~6.0.24 | Navegação baseada em arquivos |
| react-native-tcp-socket | ^6.4.1 | Conexões TCP brutas (túnel) |
| @notifee/react-native | ^9.1.8 | Foreground Service (background keep-alive) |
| expo-camera | ~17.0.10 | Leitura de QR Code |
| expo-secure-store | ~15.0.8 | Armazenamento seguro do token JWT |
| @shopify/flash-list | 2.0.2 | Lista de logs com alto desempenho |

## Arquitetura

```
hivenode-app/
├── src/
│   ├── app/
│   │   ├── _layout.tsx      # Root layout + controle da Splash Screen
│   │   └── index.tsx        # Tela única (toda a lógica: login, QR, tunnel, logs)
│   └── lib/
│       └── hostValidator.ts # Validação de hosts para prevenir SSRF
├── android/                 # Projeto Android nativo (gerado pelo Expo)
├── app.json                 # Config do Expo (versão, plugins, permissions)
├── eas.json                 # Config de build EAS (preview=APK, production=APK)
└── package.json             # Dependências
```

## Configurações Críticas

### Nova Arquitetura (`gradle.properties`)
```properties
newArchEnabled=false  # IMPORTANTE: false por compatibilidade com notifee e tcp-socket
hermesEnabled=true    # Hermes habilitado (melhor performance)
```

> ⚠️ **NÃO habilitar `newArchEnabled=true`** enquanto `@notifee/react-native` e `react-native-tcp-socket` não tiverem suporte completo à Nova Arquitetura. Habilitar causa crash nativo imediato na Splash Screen (especialmente em Android 9/10 como Realme 5).

### React Compiler (`app.json`)
```json
"experiments": {
  "typedRoutes": true
  // reactCompiler: NÃO usar — beta incompatível com Hermes em ARM
}
```

## Decisões Técnicas

### Por que `newArchEnabled=false`?
As libs `@notifee/react-native` (ForegroundService) e `react-native-tcp-socket` não têm suporte completo ao novo bridge Fabric/TurboModules do RN 0.71+. Isso causava crash nativo antes do JS inicializar em dispositivos ARM (Android 9/10 como Realme 5 e similares).

### Por que Foreground Service?
O Android mata processos em background agressivamente. O Notifee mantém o app como Foreground Service exibindo uma notificação persistente, garantindo que o túnel TCP permaneça ativo mesmo com a tela desligada.

### Por que `SecureStore` para o token JWT?
O token de sessão precisa de armazenamento seguro (TEE/Keystore). `AsyncStorage` é plain-text e vulnerável. Apenas dados não-sensíveis (serverIp, nodeName) ficam no AsyncStorage.

### Race Condition NetInfo
O `NetInfo.addEventListener` pode disparar antes do `AsyncStorage.getItem` completar. Por isso, usamos `sessionLoaded ref` + `nodeIdRef` para garantir que `connectToBroker()` só é chamado após a sessão ser carregada.

## Build & Deploy

### Preview APK (EAS Cloud)
```bash
cd hivenode-app
eas build --platform android --profile preview
```

### Channels
- `preview` → APK para teste interno
- `production` → APK para distribuição

## Versão Atual
- **app.json**: `1.1.1`
- **versionCode**: `2`
- **package.json**: `1.1.0`

## Histórico de Versões
| Versão | Data | Mudanças |
|---|---|---|
| 1.1.1 | 2026-08-06 | Fix crash Realme 5: desabilita Nova Arquitetura, remove reactCompiler, corrige race condition NetInfo, remove FOREGROUND_SERVICE_DATA_SYNC |
| 1.0.0 | inicial | Release inicial |
