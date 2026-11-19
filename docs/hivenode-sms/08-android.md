# Especificação Android principal e Light

## Plataformas e distribuição

A primeira prova usa APK assinado do Android principal e o canal de instalação previsto. Confirmar no aparelho permissões, seleção de SIM e um envio controlado em linha elegível. `SEND_SMS` é restrita pelo instalador. Distinguir permissão recusada, instalada por canal incompatível e telephony indisponível. Na distribuição no Brasil, validar a exigência de verificação de desenvolvedor conforme o canal. O build de proxy pode manter manifesto sem `SEND_SMS` se o canal do piloto exigir variante. [Permissão SEND_SMS](https://developer.android.com/reference/android/Manifest.permission#SEND_SMS) e [verificação de desenvolvedor](https://developer.android.com/developer-verification).

HiveNode principal permanece Expo SDK 54/RN 0.81, módulo local `hivenode-sms` com executor Kotlin e persistência nativa. O target gerado deve ser inspecionado e documentado na issue; referência SDK54 indica compile/target 36, mínimo Android 7. SMS do produto será habilitado somente Android 8/API26 ou superior no piloto. Não é necessário elevar mínimo de todo o proxy para habilitar SMS. [Expo SDK54](https://docs.expo.dev/versions/v54.0.0/).

Não usar `expo-sms` como gateway silencioso: o recurso necessário é execução nativa pela telephony API. Criar módulo via Expo Modules API e build próprio; não validar modem usando Expo Go. [Módulos locais](https://docs.expo.dev/modules/get-started/).

Light atual usa compile/target 22 e min16. Sua issue deve modernizar toolchain/build de forma compatível e compartilhar contratos. SMS Light v1 só em API>=26; versões antigas anunciam `smsSupported=false`, mantêm proxy e não apresentam autorização SMS. Não usar APIs privadas de dual SIM no Android antigo. A release do Light depende de build assinado e gate próprio.

Google Play exige enquadramento das permissões SMS; declarações e possível exceção precisam de avaliação. APK empresarial/MDM é opção de distribuição, não dispensa proteção de dados ou regras da linha. Não publicar nem solicitar permissões desnecessárias antes dessa avaliação. [Política Google Play](https://support.google.com/googleplay/android-developer/answer/10208820).

## Permissões mínimas e confirmação

- SEND_SMS: solicitada somente ao ativar SMS, com explicação de uso do chip e possíveis tarifas.
- READ_PHONE_STATE: para inventário de assinaturas ativas/estado permitido.
- READ_PHONE_NUMBERS: opcional; só se número automático for necessário. Permitir número ausente e verificação manual.
- Notificações/FGS: conforme versão/target e arquitetura legitimamente aplicável.
- Não solicitar READ_SMS/RECEIVE_SMS/Call Log/Accessibility na v1. Descadastro é via link público.

Negar uma permissão deixa proxy utilizável e SMS bloqueado. Revogação gera diagnóstico PERMISSION_REQUIRED; não fica solicitando repetidamente. Autorização local mostra conta, aparelho, chips habilitados, controle remoto, custos pela operadora, forma de pausar e versão dos termos. Aceite remoto não substitui essa confirmação do aparelho.

## Inventário e vínculo

Consultar `SubscriptionManager.getActiveSubscriptionInfoList()` e ouvir mudanças de assinatura. API31+ usa `SmsManager.createForSubscriptionId`; compatível anterior usa método público por subscriptionId. Não escolher default implicitamente. Consultar features telephony/subscription/messaging antes de chamar. [SubscriptionManager](https://developer.android.com/reference/android/telephony/SubscriptionManager), [SmsManager](https://developer.android.com/reference/android/telephony/SmsManager).

`subscriptionId` e slot não são identidade permanente do chip. Gerar localBindingId com epoch/vínculo local, incrementar inventoryVersion ao alterar inventário e exigir novo consentimento quando não houver prova segura de continuidade. Não inferir identidade apenas porque voltou ao slot1 ou manteve número. Sem identificadores estáveis acessíveis, pausar é comportamento esperado.

SIM PIN locked, desativado, removido, eSIM inativo ou indisponibilidade de rádio viram estados distintos quando observáveis. Não ativar eSIM/PIN/roaming/airplane mode automaticamente. Número retornado pode faltar ou estar incorreto: mascarar, permitir etiqueta e confirmar remetente por teste controlado; não usá-lo como autenticação.

Dois chips não significam dois modems simultâneos. Baseline serializa todo envio por aparelho e aplica rate/contador adicional por SIM. Seleção sempre explícita; sem failover silencioso para outro remetente.

## Interface nativa projetada

```text
getCapabilities() -> AndroidSmsCapabilities
listActiveSubscriptions() -> SmsInventory
requestSmsActivation(selectedBindings) -> ActivationResult
previewSms(simBindingId, text) -> {partsCount, encodingHint, fingerprint}
startAgent(workspaceId, nodeId, installationEpoch) -> AgentStatus
pauseSms(reason) -> AgentStatus
getLocalAttempt(attemptId) -> AttemptSnapshot
flushPendingEvents() -> SyncResult
```

Nenhum método público JS deve permitir `send(to,text)` sem grant verificado. Executor interno recebe SignedDispatchGrant+mensagem autorizada e pertence ao agente. Tipos compartilhados validam entrada e limites.

Persistência: Room/SQLite nativo em principal e Light, tabelas inbox, attempts, segmentCallbacks, eventsOutbox, bindingEpochs e maxFence. Transações em thread apropriada; texto cifrado com chave protegida por Android Keystore; não confiar em AsyncStorage para um efeito físico crítico. Limpar conteúdo após ACK+retenção, preservando tombstone da tentativa por até 180 dias com fingerprint/hash necessário e política documentada.

Callbacks devem sobreviver à Activity e ao bridge JS. PendingIntent com identidade única por attempt+segment+tipo; flags explícitas compatíveis com target, componentes não exportados salvo necessidade documentada. Registrar RECEIVED/INVOKING antes do modem; recomeço em INVOKING exige conciliação, não novo send.

## Segundo plano e energia

A issue de investigação entrega matriz por Android 8/12/14/15/16 e pelo menos um fabricante com política agressiva. Serviço em foreground deve ter tipo elegível, notificação visível, timeout e parada limpa. Não perpetuar `dataSync` 24h por um WakeLock. Não usar tipo `remoteMessaging` apenas porque o nome parece adequado: demonstrar elegibilidade e regras de distribuição antes de escolher.

Sincronização periódica WorkManager tem latência e restrições do SO; não promete envio instantâneo. Notificação de pausa solicita abertura do app quando necessário. Startup após reboot respeita restrições; usuário force-stop não pode ser contornado. Telemetria separa ONLINE_PROXY, SMS_AGENT_AVAILABLE, SMS_PERMISSION_MISSING e BACKGROUND_RESTRICTED.

Não degradar o proxy com lock de modem, trabalho de banco na UI ou interrupção da conexão ao pausar SMS. Logout/revogação da conta no app para novos grants e encerra agente de forma segura; eventos prévios podem ser reconciliados com credencial restrita válida. Factory reset/reinstalação cria epoch nova, que não assume tentativas pendentes da instalação velha.

## Teste antes do aparelho físico

Unitários de executor com fake modem, banco temporário e callbacks sintéticos; negar permissão, troca de binding, replay, fence antigo, kill entre persistência/chamada, evento repetido e multipart. Compilar módulo/APKs, testar bridge e UI em emulador. Esses testes comprovam lógica/build, não entrega de operadora.

HNS-32 homologa o Android principal com build, instalador, responsável, modelo e linha registrados. HNS-36 homologa o Light separadamente. Até o aceite do principal, manter envio de produção desligado. O roteiro está em [testes](11-testes.md).

Na sessão ativa, começar com heartbeat a cada 30s e presença válida por 90s no servidor como defaults de piloto. O agente pode consultar trabalho a cada 15s durante sessão visível, com espera crescente até 60s quando ocioso. Presença vencida ou força de parada mostram “Abra o app no aparelho”. Medir bateria, temperatura, tráfego e latência antes de publicar a faixa suportada. Reboot ou reinstalação exigem retomar a sessão e obter nova referência de horário. No Android 15, force-stop pode cancelar os `PendingIntent`. [Comportamento do Android 15](https://developer.android.com/about/versions/15/behavior-changes-all).

Explicar que o Android pode gravar uma cópia no histórico local e que respostas chegam à linha do cliente. Excluir identidade SMS, credenciais, inbox e fila de eventos da transferência e do backup do app. A restauração em outro aparelho exige pareamento novo e nunca invoca fila restaurada. [Backup Android](https://developer.android.com/identity/data/autobackup) e [SmsManager](https://developer.android.com/reference/android/telephony/SmsManager).
