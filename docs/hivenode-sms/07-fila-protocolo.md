# Fila, estados e protocolo de execução

## Máquina de estados da mensagem

| Estado | Significado | Próximos estados permitidos |
|---|---|---|
| QUEUED | Persistida, aguardando agenda/linha | LEASED, CANCELED, EXPIRED, SUPPRESSED, SUSPENDED |
| LEASED | Uma instalação retirou o comando; nenhum efeito comprovado | AUTHORIZED, QUEUED, SUSPENDED, CANCELED, EXPIRED, FAILED |
| AUTHORIZED | Grant físico emitido para tentativa específica | SENDING, UNKNOWN, FAILED |
| SENDING | App persistiu INVOKING e invocou o modem | SENT, PARTIAL, FAILED, UNKNOWN |
| SENT | Todos os segmentos aceitos no resultado de envio | DELIVERED; permanece SENT se recibo não chega |
| DELIVERED | Todos os segmentos tiveram recibo positivo | Terminal |
| PARTIAL | Alguns segmentos enviados e outros falharam/incertos | UNKNOWN, SENT, DELIVERED ou FAILED somente por evidência/correção auditada; nenhum retry integral automático |
| FAILED | Falha classificada, com resultado conhecido | QUEUED apenas se retry seguro; senão terminal |
| UNKNOWN | Efeito físico não pode ser determinado | SENT, DELIVERED, PARTIAL, FAILED mediante evidência; sem retry automático |
| SUSPENDED | Política/assinatura/membro exige revisão | QUEUED por ação autorizada se ainda válido; EXPIRED, CANCELED |
| CANCELED | Cancelada antes de grant | Terminal |
| EXPIRED | Validade terminou antes de grant | Terminal |
| SUPPRESSED | Descadastro bloqueou marketing antes de grant | Terminal |

AUTHORIZED/SENDING não são canceláveis com garantia. Endpoint de cancelamento retorna 409 `ALREADY_AUTHORIZED`; UI explica que SMS aceito pelo modem não pode ser recolhido. Pausa/descadastro/kill switch impedem novos grants; um grant já emitido pode executar por sua curta validade. Essa corrida deve ser exposta e testada, nunca descrita como cancelamento instantâneo absoluto.

Delivery é outra dimensão por segmento: PENDING, DELIVERED, FAILED, UNAVAILABLE. Recibo negativo não autoriza reenviar SMS já enviado. Após 24h sem confirmação, delivery fica UNAVAILABLE; mensagem SENT continua SENT, com entrega não confirmada. Recibo tardio até o limite de retenção atualiza delivery sem recontar envio.

## Fluxo físico em oito passos

1. Cliente solicita envio: validar conta, ator, entitlement, SIM, conteúdo e supressão; transação grava mensagem/idempotência/outbox. Responder 202 com ID, não com promessa de entrega.
2. Publisher publica `sms-<messageId>` (sem `:` no jobId). Worker prepara disponibilidade; reconciliação também pode encontrar mensagem mesmo se Redis cair.
3. Agente `POST /api/device/v1/sms/claim` recebe no máximo uma tentativa em lease de 120s, pinned ao node/epoch/SIM/inventoryVersion, schedule/expiry e body cifrado no trânsito TLS.
4. App persiste RECEIVED em banco local; calcula divisão via SmsManager, verifica permissão e vínculo; grava número de segmentos/hash da divisão. Solicita grant com preview e lease.
5. Servidor revalida todas as regras e reserva segmentos do trial. Emite grant assinado, único para tentativa, com validade máxima 30s limitada por expiresAt. Armazena autorização e fencingToken crescente.
6. App valida assinatura/claims e relógio usando horário obtido do servidor, não apenas relógio local; transação local grava INVOKING **antes** de chamar modem. Verifica linha/permissão novamente. Reiniciar nesse estado nunca reinvoca automaticamente.
7. SmsManager executa uma vez; cada callback grava evento/segmento no banco nativo. JS não é necessário para guardar o resultado. Callback correlaciona attemptId e segmentIndex com PendingIntent não ambíguo.
8. App envia eventos deduplicáveis; servidor aplica CAS, atualiza contadores e outbox de webhook. Agente exclui eventos locais apenas após ACK persistido.

Um gap entre INVOKING e chamada física também pode produzir UNKNOWN sem envio real. Preferir incerteza explicada a duplicação silenciosa. Não existe transação distribuída com modem que garanta exatamente uma execução em todas as quedas.

## Grants e fencing

Grant assinado com chave assimétrica do servidor e kid, claims `aud=hivenode-sms-device`, workspaceId, nodeId, installationEpoch, simBindingId, inventoryVersion, messageId, attemptId, grantId, fencingToken, bodyFingerprint, recipientFingerprint, segments, iat, exp. Chave pública versionada entregue ao agente por configuração autenticada. Nunca guardar private key no APK.

Baseline de assinatura: JWT ES256 com issuer fixo e allowlist estrita de algoritmo/kid; rejeitar alg=none, chave desconhecida e audience diferente. Fingerprints do grant são SHA256 dos bytes UTF-8 do texto final/destino E.164, enviados somente no canal protegido; não são HMAC de lookup/idempotência. `previewFingerprint` é SHA256 do JSON canônico RFC8785 `{version:1,parts:[...]}` com as partes calculadas pelo Android; persistir junto à tentativa. O servidor valida quantidade/limites e vincula o grant ao texto/destino; a divisão nativa fica local e não vai para logs.

Sandbox não emite grant de modem: tentativa tem executionMode SIMULATED e audience `hivenode-sms-simulator`, com chave de teste distinta. Agente físico rejeita esse audience/mode e o servidor nunca promove tentativa simulada a REAL. Só allowlist física, política elegível e flag real habilitada permitem audience `hivenode-sms-device`. O cliente não escolhe mode no body público; execução simulada não pode ser replayada contra aparelho real.

O agente é uma fronteira de confiança: um aparelho adulterado pode mentir sobre callbacks/segmentos ou enviar SMS fora do HiveNode. A plataforma não comprova criptograficamente a entrega da operadora nem conta todo SMS feito por outros apps. Revogar aparelho suspeito e não apresentar telemetria como extrato oficial da operadora.

Assinatura não substitui validação de node/SIM/epoch. Dispositivo persiste maior fencingToken e rejeita comando repetido/outra instalação. Perder lease depois de AUTHORIZED produz UNKNOWN; não liberar novo grant só porque TTL expirou. Grant não pode ser reutilizado para outra mensagem nem reemitido com ID novo para a mesma tentativa depois de INVOKING.

Sem confirmação de grant emitido, app pergunta estado pelo attemptId. Não tenta outra linha. Sem rede, só executa um grant ainda válido e já persistido; nunca cria fila offline nova para execução futura sem verificação.

## Retentativas

- Antes de grant, queda/reentrega é segura com mesmo attemptId enquanto app comprova não ter INVOKING.
- Após grant, retry físico só quando o resultado comprova **zero segmentos aceitos**, permite retry e está conciliado. Generic failure, timeout, erro de modem e rede ambígua não são automaticamente seguros.
- Defaults de piloto: até 3 tentativas físicas no total, esperas mínimas 30s e 120s com jitter determinístico nos testes; sempre respeitar expiração e rate da linha.
- Erro de permissão, destinatário inválido, SIM removido, contrato, supressão e block do cliente não fazem retry automático.
- Mensagem PARTIAL/UNKNOWN exige investigação. Reenvio deliberado cria nova mensagem com `resendOf` e confirmação de possível duplicação, não muta a antiga para QUEUED.
- BullMQ retry é retry de trabalho do servidor, não autorização para invocar SmsManager de novo.

## Diagnóstico normalizado

Objeto: `category`, `platformCode?`, `certainty=CONFIRMED|PROBABLE|UNKNOWN`, `retrySafe`, `retryAfter?`, `userAction`, `message`, `occurredAt`. Categorias: DEVICE_OFFLINE, PERMISSION_REQUIRED, SIM_UNAVAILABLE, LINE_POLICY_REQUIRED, PLATFORM_RATE_LIMIT, NETWORK_UNAVAILABLE, NETWORK_REJECTED, ANDROID_LIMIT, INVALID_RECIPIENT, PARTIAL_SEND, EXECUTION_UNKNOWN, SUBSCRIPTION_INACTIVE, ACTOR_REVOKED, SUPPRESSED, GENERIC_FAILURE.

Não afirmar crédito insuficiente/bloqueio antispam sem evidência específica. `RESULT_ERROR_LIMIT_EXCEEDED` não mede franquia mensal da operadora. Hipóteses orientam contato, nunca mudança automática de SIM/remetente para contornar rejeição.

## Agenda e payload

Instantes UTC; apresentação usa timezone IANA escolhido. `scheduledAt` até 7 dias à frente; validade padrão 24h após agenda, máximo 7 dias após agenda. Conteúdo pendente necessário até expiração; no máximo 30 dias desde criação e 7 dias após terminal por padrão. Se retenção reduzir abaixo da agenda, rejeitar antes de aceitar; nunca enviar corpo já purgado.

Lote até 100 destinos únicos por requisição. Preservar clientItemId; validar lote inteiro antes de commit; caso qualquer item seja inválido, 422 e nenhum item criado. Após aceite, cada item tem execução independente. Dedup de destinos dentro do mesmo lote gera 422, não remove silenciosamente.

## Eventos, outbox e reconciliação

Evento mínimo: eventId UUID, eventType, nodeId, epoch, attemptId, deviceSequence inteiro, segmentIndex quando aplicável, platformCode, occurredAt, receivedAt servidor. Sequência monotônica por instalação; dedup por evento/seq. Receber fora de ordem deve convergir por segmento, sem regredir DELIVERED para SENT.

Publisher pode repetir publicação; estado DB decide. Reconciliação a cada 30s encontra claims vencidos e grants/INVOCANDO sem eventos. Se servidor reiniciar, attempts e reservas persistidas mantêm exclusão. DLQ tem erro, tentativas e reprocessamento auditado; replay de webhook não reenvia SMS. Não usar corpo de mensagem em job data ou DLQ.

Ordenação de dispatch: por `scheduledAt,createdAt,id` dentro da linha, com rodízio entre linhas disponíveis e contas para evitar que um lote monopolize o worker. A exclusão por aparelho continua superior ao rodízio. Política segmentRate reserva tokens antes do grant; `periodCap`, quando presente, especifica contagem de segmentos e intervalo UTC startAt/endAt explícito, sem reset mensal presumido. Resultado UNKNOWN mantém reserva conservadora; zero segmentos aceitos comprovados permite liberação idempotente. Se replay cache/autorização estiver indisponível, novo grant retorna503 e não opera em modo permissivo.

Referências: [BullMQ job IDs](https://docs.bullmq.io/guide/jobs/job-ids), [jobs idempotentes](https://docs.bullmq.io/patterns/idempotent-jobs), [Android SmsManager](https://developer.android.com/reference/android/telephony/SmsManager). A política de retry seguro é uma decisão conservadora deste projeto.
