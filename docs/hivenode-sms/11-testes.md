# Plano de testes e execução para devs juniores

## Situação e gates

Este documento descreve testes A EXECUTAR durante implementação. Nesta entrega foi validada a documentação, não o sistema SMS. Não reaproveitar resultados antigos como prova da funcionalidade nova.

| Gate | Pode executar sem celular? | Situação inicial |
|---|---|---|
| D — integridade documental | Sim | Executar nesta entrega |
| A — unitários/contratos/isolamento | Sim | PENDENTE_IMPLEMENTACAO |
| B — integração DB/Redis/API/worker/simulador | Sim | PENDENTE_IMPLEMENTACAO |
| C — navegador/MCP/proxy/migração/carga | Sim | PENDENTE_IMPLEMENTACAO |
| N — build e testes nativos/emulador | Com JDK/SDK, sem linha real | PENDENTE_IMPLEMENTACAO |
| P — homologação de aparelhos e operadoras | Não | PENDENTE_APARELHO; proprietário testa daqui a alguns dias |
| L — jurídico/comercial/gateway/distribuição | Responsáveis e contratos | PENDENTE_VALIDACAO |

Aprovar A/B/C/N não libera envio real. Publicação exige P/L e gates anteriores. Marcações possíveis: PASSOU, FALHOU, BLOQUEADO, NAO_EXECUTADO; sempre acompanhar ambiente e evidência. Não marcar NAO_EXECUTADO como aprovado.

## Ambiente isolado e baseline EXISTENTE

Pré-requisitos: Node >=20.19 compatível com Expo54, npm, Go compatível com módulos (broker go1.23), Docker Desktop ativo, portas 55432/56379/3100/11000/11001 livres. JDK/Android SDK somente para gate N/P. `hivenode-app`, `hivedocker` e outros apps são repositórios próprios; conferir status antes de instalar/buildar.

Nunca apontar DATABASE_URL de teste para produção. Conferir as variáveis antes de `migrate deploy`. Fixture não usa contatos reais nem gateway de pagamento real. Os valores abaixo são somente credenciais locais publicáveis, já usadas no ambiente de teste do repositório.

Na raiz:

```powershell
docker compose --project-name hivenode-test -f docker-compose.test.yml up -d --wait
```

Na pasta `web`, depois de instalar dependências do lockfile (`npm ci`):

```powershell
$env:APP_ENV = 'test'
$env:DATABASE_URL = 'postgresql://hivenode_test:local-test-only@127.0.0.1:55432/hivenode_test'
$env:REDIS_URL = 'redis://127.0.0.1:56379/0'
$env:JWT_SECRET = 'local-test-jwt-secret-at-least-32-characters'
$env:ENCRYPTION_KEY = 'local-test-encryption-key-at-least-32-characters'
$env:BROKER_INTERNAL_SECRET = 'local-test-internal-secret-at-least-32-characters'
$env:NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3100'
$env:WEB_API_URL = 'http://127.0.0.1:3100'
$env:SMS_REAL_SEND_ENABLED = 'false'
npm run db:migrate:deploy
npm test
npm run typecheck
npm run lint -- --max-warnings=0
npm run test:integration
npm run build
npm run test:browser
```

`test:integration` inicia/encerra web e broker e hoje importa `ws` de `hivedocker/node_modules`; instalar dependências de hivedocker se ausentes. Gate de infraestrutura deve eliminar esse acoplamento em script novo, sem presumir que já foi corrigido. `test:browser` usa build standalone e browser disponível; checar instalação/configuração Playwright.

Outras regressões existentes, cada comando na pasta indicada:

```text
broker:                    go test ./... ; go vet ./...
hivenode-light/native-go:   go test ./... ; go vet ./...
hivedocker:                npm test
hivenode-app:              npm run typecheck
hiveminer-app:             npm run typecheck
raiz:                      node scripts/mobile-validation.cjs
```

Os `;` acima são apenas separadores de leitura; executar cada comando separadamente. `go test -race ./...` é gate adicional quando toolchain CGO disponível; registrar indisponibilidade e executar em CI Linux configurado. Não executar reset/db push para fazer o teste passar.

## Scripts novos A CRIAR pela issue HNS-03

| Script npm proposto em web | Responsabilidade |
|---|---|
| `test:sms:unit` | State machine, grants, policies, entitlements, serializers, diagnostics |
| `test:sms:integration` | DB/Redis/API/worker + agente simulado, fixture própria por runId |
| `test:teams:integration` | Conta/equipe/convites, concorrência e migração |
| `test:sms:browser` | Playwright jornadas cliente, sem admin de atalho |
| `test:sms:contracts` | Validação OpenAPI/JSON schemas e contract tests de server/client |
| `test:sms:load` | Perfil staging 10 requests/s/conta, 10min, sem modem |
| `test:sms:chaos` | Quedas nos pontos críticos e convergência |
| `sms:simulator` | Agente fake standalone com cenários, sem Telephony |

Adicionar scripts/configuração explícitos; `npm run test:e2e` existe no package, mas configuração Playwright completa não foi encontrada na inspeção. HNS-03/HNS-27 devem criá-la/ajustá-la; não documentar o script como cobertura pronta.

## Fixtures

Gerar runId e contas A/B, OWNER, ADMINISTRATOR, OPERATOR_SMS, OPERATOR_PROXY, VIEWER e membro das duas contas. Planos SMS Inicial/Equipe/Operação e proxy legado com benefício 1. Dois nós privados de A, um B, um público e um NodeShare A→B. SIM1/SIM2 em A com política fake válida SOMENTE APP_ENV=test. Tokens separados por finalidade, nomes falsos, número fictício normalizado sem rede externa.

Simulador jamais chama modem nem serviço SMS externo. Deve rejeitar uso em production, emitir `SIMULATED` em evidências e aceitar fake clock/seed. Dados de ensaio financeiros têm provider mock; flag não permite criar assinatura paga em produção. Teardown só apaga runId do banco de teste ou encerra compose isolado; não remover pastas/volumes do projeto por conveniência.

## Matriz executável de casos

| ID | Caso e resultado obrigatório | Requisitos |
|---|---|---|
| T01 | Backfill duas vezes: mesmas contas/IDs, saldo e assinaturas | R01,R22 |
| T02 | OWNER e usuário em duas contas: troca não mistura caches | R01,R02,R12 |
| T03 | IDs da conta B consultados por A: 404 e sem metadados | R03,R13 |
| T04 | NodeShare/público não concede SMS, mas proxy mantém regra | R03,R06,R22 |
| T05 | Última vaga com dois convites concorrentes: um sucesso | R02 |
| T06 | Remover membro revoga key e novo grant, preserva aparelho | R03,R13,R17 |
| T07 | Convite expirado/email errado/replay falha; OWNER único | R02,R03 |
| T08 | Maior benefício, não soma; downgrade mantém OWNER | R02,R04 |
| T09 | Habilitar último aparelho em corrida: uma única vaga | R04,R06 |
| T10 | Trial reserva segmentos em corrida, multipart e UNKNOWN | R04,R07 |
| T11 | Cancelar SMS só no fim pago; proxy continua | R04,R22 |
| T12 | Upgrade por cotação, delta/meses curtos/ano bissexto | R04 |
| T13 | Reativação não dispara fila velha/vencida | R04,R08,R19 |
| T14 | Webhook pagamento duplicado/fora de ordem/refund isolado | R04,R22 |
| T15 | Mesmo key e payload concorrentes: um ID/outbox | R07 |
| T16 | Mesmo key e corpo/destino/conta distintos: escopo/409 corretos | R07,R13 |
| T17 | Agenda UTC/fuso/DST e lote inválido: nenhum commit parcial | R08 |
| T18 | Marketing descadastrado antes do grant: SUPPRESSED | R06,R16 |
| T19 | Ausência de política/aceite/permissão: sem grant/modem | R06,R17 |
| T20 | Dois claims/grants no mesmo aparelho: um executor | R07,R10 |
| T21 | Nonce/grant/fence/epoch repetido ou adulterado: rejeitado | R10,R13,R18 |
| T22 | Queda antes de grant recupera intenção sem duplicar | R07,R10 |
| T23 | Grant emitido, resposta perdida: recuperar grant existente | R09,R10 |
| T24 | Crash após INVOKING antes/durante modem: UNKNOWN sem retry | R09,R10 |
| T25 | Modem enviou, evento perdeu ACK: replay não reenvia | R09,R10,R15 |
| T26 | Zero segmentos aceitos e falha segura: até 3 tentativas | R10,R11 |
| T27 | Multipart parcial/eventos invertidos/repetidos: PARTIAL, contadores exatos | R09,R10 |
| T28 | SENT sem receipt: SENT com entrega não confirmada | R09,R11 |
| T29 | Recibo tardio e duplicado: converge sem regredir estado | R09,R15 |
| T30 | SIM troca/remoção/mesmo slot: invalida binding e pausa | R05,R18 |
| T31 | Generic/network erro: certeza e retrySafe conservadores | R11 |
| T32 | Só SMS funciona sem assinatura/túnel proxy | R04,R18,R22 |
| T33 | OWNER/VIEWER/SMS-only navegam UI com acessibilidade | R03,R12 |
| T34 | Key read-only/device limitado não pode enviar em outro nó | R13 |
| T35 | REST e MCP geram mesmo erro/estado para mesma solicitação | R07,R14 |
| T36 | Texto com prompt injection não altera scopes/política | R14,R16 |
| T37 | Webhook duplicate/timeout/410/replay: sem SMS extra | R15 |
| T38 | Webhook SSRF/DNS rebinding/IPv6/redirect: bloqueado | R15,R16 |
| T39 | Exportação sem content grant, revogação antes de download, CSV formula | R03,R12,R16 |
| T40 | Retenção remove corpo de DB/cache/export/app; logs sem PII | R16,R17 |
| T41 | Kill switch/DB indisponível impedem grant novo e mantêm ingestão final | R19 |
| T42 | Redis/fila indisponível após commit: outbox recupera | R07,R19 |
| T43 | Broker tickets/realtime não vazam para outro membro/conta | R03,R22 |
| T44 | Bytes, créditos, proxy público e compartilhamento têm totais anteriores | R22 |
| T45 | Tornar node público com SMS habilitado é rejeitado | R03,R06,R22 |
| T46 | Limites API/lote/fila/segmentos produzem erro público, sem cobrança | R07,R08,R21 |
| T47 | Carga alvo: p95 e memória medidos, sem criação duplicada | R19,R20,R21 |
| T48 | Migração+rollback compatível preserva dados de equipe | R01,R20,R22 |
| T49 | APK principal/Light compila e fakes validam bridge/persistência | R05,R18,R20 |
| T50 | Segundo plano/reboot/force-stop/two-SIM no aparelho físico | R05,R18,R20 |
| T51 | Aceite versionado e ações por API/MCP preservam ator/canal | R13,R14,R17 |
| T52 | Canal de distribuição/pagamento real/linha elegível documentados | R04,R06,R20 |
| T53 | Ordem retention x agenda: corpo necessário existe até validade | R08,R16 |
| T54 | Pausa/revogação após grant mostra limite real de cancelamento | R09,R19 |

## Simulador e injeção de falha

Cenários mínimos: success; offline_before_claim; fail_before_grant; grant_response_lost; crash_before_modem; crash_after_modem; callback_ack_lost; multipart_partial; delayed_delivery; no_delivery_receipt; sim_removed; permission_revoked; stale_epoch; duplicate_event; reordered_events; redis_outage; revoked_actor; expired_subscription.

Cada cenário declara ponto de falha, número de chamadas fake ao modem, eventos emitidos, estados esperados e contador. Assert de chamadas físicas fake é indispensável para duplicação; testar só HTTP 200 não serve. Ciclos de crash usam persistência real temporária e reinício de processo, não apenas mock que esquece estado.

## Homologação física futura — proprietário

Executar com consentimento, plano que permita o uso e poucos destinos controlados. Nada de testes de spam/volume massivo ou bloqueio intencional de operadora.

1. Registrar build/hash, modelo, Android/API, app principal/Light, operadora/plano e evidência da linha; não registrar ICCID/segredos no relatório.
2. Instalar APK próprio, confirmar conta e SMS; negar permissões e verificar proxy utilizável; depois conceder.
3. Detectar SIM1/SIM2/eSIM ativo quando disponíveis; escolher cada um e verificar remetente no destinatário controlado.
4. Enviar texto curto e multipart com caracteres/emoji; comparar preview/segmentos e callbacks reais.
5. Verificar SENT/DELIVERED conforme relatórios disponíveis; receipt ausente fica não confirmado.
6. Desligar rede de dados mantendo situação de linha documentada, reconectar e conciliar; repetir callback não duplica.
7. Testar tela apagada, app em background, restrições de energia, reboot e force-stop. Anotar latência e necessidade de abrir app.
8. Remover/desativar/trocar chip no mesmo slot: fila pausa e requer vínculo novo.
9. Revogar permissão, membro e chave: nenhum grant novo; tentativas já autorizadas seguem limite documentado.
10. Simular perda de processo em ponto controlado de build debug e confirmar UNKNOWN; não reenviar sem decisão.
11. Pausar SMS enquanto proxy trafega; medir reconexão/bytes e verificar que não foi interrompido por lógica SMS.
12. Homologar Light separadamente; aparelhos API<26 anunciam incompatibilidade SMS e mantêm proxy.

Um aparelho com um SIM não comprova dual SIM. Emulador não comprova rede real. Se não houver modelos/fabricantes suficientes, publicar lista restrita de compatibilidade em vez de suporte universal.

## Evidência e encerramento

Para cada Txx: commit/build, data/fuso, ambiente, fixture, passos, resultado esperado/observado, PASSOU/FALHOU/BLOQUEADO/NAO_EXECUTADO, logs redigidos e responsável. `validation-status.json` deve manter gate P pendente até o proprietário registrar o resultado. Reportar falhas preexistentes fora do escopo sem escondê-las.
