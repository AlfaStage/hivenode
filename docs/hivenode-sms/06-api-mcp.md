# Contratos REST, credenciais, MCP e webhooks

## Regras comuns

REST novo em `/api/v1/workspaces/{workspaceId}`; APIs atuais continuam durante migração. JSON UTF-8, UUID, E.164, datas RFC3339 UTC, timezone IANA. Valores monetários em centavos. Paginação por cursor opaco vinculado a conta/filtro, default 25, máximo 100. Ordenar createdAt+id para paginação estável.

Resposta de sucesso: `{ "data": ..., "requestId": "uuid" }`. Erro: `{ "error": { "code": "...", "message": "...", "details": {} }, "requestId": "uuid" }`. Nunca devolver stack/segredos. OpenAPI projetado: [contrato](contracts/openapi.json).

Autenticação: cookie de pessoa ou bearer API key em REST; navegador usa verificação de Origin e token CSRF para mutações. Serviço e credencial têm escopos próprios. Device HMAC é outra fronteira. Endpoint público de descadastro usa token opaco específico, não credencial de envio. CORS allowlist explícita; `*` não concede permissão.

| HTTP | Uso |
|---|---|
| 200/201 | Leitura/atualização/criação de cadastro |
| 202 | Intenção de envio/lote aceita e persistida, sem afirmar sucesso físico |
| 400 | JSON/header inválido |
| 401 | Identidade ausente, expirada ou inválida |
| 403 | Membro conhecido sem permissão / regra de execução |
| 404 | Objeto ausente ou de outra conta |
| 409 | Chave idempotente conflitante, capacidade ou estado incompatível |
| 422 | Destino, conteúdo, agenda, finalidade ou política inválidos |
| 429 | Limite público com Retry-After; não cobra excedente |
| 503 | Dependência indisponível; estado persistido determina se cliente pode repetir |

## Envio

`POST /api/v1/workspaces/{workspaceId}/sms/messages`, headers `Authorization` ou cookie e `Idempotency-Key` de 16–128 caracteres ASCII seguros. Schema exige nodeId, simBindingId, purpose, to, text; opcionais scheduledAt, expiresAt e clientReference. Campo extra desconhecido gera 422, salvo extensões versionadas.

```json
{
  "nodeId": "11111111-1111-4111-8111-111111111111",
  "simBindingId": "22222222-2222-4222-8222-222222222222",
  "purpose": "TRANSACTIONAL",
  "to": "+5511999999999",
  "text": "Sua confirmação está pronta.",
  "scheduledAt": "2026-10-20T13:00:00Z",
  "expiresAt": "2026-10-21T13:00:00Z",
  "clientReference": "pedido-teste-001"
}
```

Exemplo usa destinatário fictício; trocar somente por número controlado e autorizado em teste real. Response 202: `{data:{id, state:"QUEUED", nodeId, simBindingId, scheduledAt, expiresAt},requestId}`. GET devolve diagnóstico/segmentos agregados, remetente mascarado e conteúdo apenas com permissão e dentro da retenção.

Chave única por conta+operação; fingerprint HMAC do JSON normalizado inclui destino, texto final, purpose, node/SIM, agenda e validade. Mesmo key+fingerprint retorna mesmo ID e HTTP 200 com `Idempotency-Replayed:true`; key diferente é solicitação diferente mesmo com conteúdo igual. Fingerprint diferente resulta 409 `IDEMPOTENCY_CONFLICT`. Tombstone e keyHash permanecem 180 dias; documentar essa janela. Após expirar a janela, consumidor deve usar novas chaves e não esperar dedup histórico eterno.

Defaults de agenda dependem do instante do primeiro aceite; retry sem agenda explícita reaproveita o mesmo recurso. Não recalcular `now` antes de comparar idempotência. Requests rejeitados antes de persistir não consomem chave; resultado UNKNOWN já persistido nunca cria nova execução ao repetir POST.

## Rotas projetadas

Prefixo W = `/api/v1/workspaces/{workspaceId}`.

| Método e rota | Permissão / resultado |
|---|---|
| GET `/api/v1/workspaces` | Contas de que a pessoa participa |
| GET W | Contexto, direitos e capacidade efetiva |
| GET/POST W`/members` | Listagem / convite (POST devolve convite) |
| PATCH/DELETE W`/members/{membershipId}` | Papel/grants / remover; OWNER protegido |
| POST W`/invitations/{invitationId}/revoke` | Revogar reserva |
| POST `/api/v1/invitations/accept` | Token+login/email verificado |
| POST W`/ownership/transfer` | OWNER com reautenticação |
| GET W`/entitlements` | Direitos independentes SMS/proxy e limite global |
| GET W`/sms/devices` | Apenas nós próprios compatíveis |
| PUT W`/sms/devices/{nodeId}` | enabled e política; capacidade sob lock |
| GET W`/sms/devices/{nodeId}/sims` | Inventário autorizado |
| PUT W`/sms/sims/{simBindingId}/policy` | Nova versão da política; nunca editar histórico |
| POST W`/sms/terms/accept` | Pessoa aceita versão/hash vigente |
| POST/GET W`/sms/messages` | Enviar / listar por cursor/filtros |
| GET W`/sms/messages/{messageId}` | Estado e dados permitidos |
| POST W`/sms/messages/{messageId}/cancel` | Apenas antes de grant; idempotente |
| POST W`/sms/messages/{messageId}/resend` | Nova mensagem, nova chave, confirmação de duplicação |
| POST/GET W`/sms/batches` | Criar lote atômico / listar |
| GET W`/sms/batches/{batchId}` | Itens paginados e agregado |
| POST W`/sms/pause` | Pausa de conta/nó/SIM; indicar escopo |
| POST W`/sms/resume` | Revisar pendentes; nunca retoma vencidas automaticamente |
| GET/POST W`/sms/templates` | Listar/criar; rendering seguro por variáveis |
| PATCH/DELETE W`/sms/templates/{templateId}` | Alterar versão/desativar |
| GET/POST W`/sms/suppressions` | Lista protegida / bloquear marketing por destino |
| GET/POST W`/sms/webhooks` | Listar/criar endpoints; URL validada |
| PATCH/DELETE W`/sms/webhooks/{endpointId}` | Alterar/desativar |
| POST W`/sms/webhooks/{endpointId}/replay` | Repetir evento, não executar SMS |
| POST W`/sms/exports` | Job exportação com filtros/escopos |
| GET W`/sms/exports/{exportId}` | Link curto após revalidar acesso |
| GET/POST W`/api-keys` | Listagem redigida / criar e exibir segredo uma vez |
| DELETE W`/api-keys/{credentialId}` | Revogação imediata de nova execução |
| POST W`/billing/quote` | Cotação de compra/troca do serviço |
| POST W`/billing/change` | Executar cotação identificada, idempotente |
| POST W`/billing/cancel` | Agendar fim de renovação por serviço |
| GET `/sms/optout/{token}` | Página pública que pede confirmação; GET não altera estado |
| POST `/api/v1/sms/optout` | Supressão por token, sem login nem telefone na URL |

Todas as rotas têm validação positiva, isolamento, permissões e testes negativos. API nova de proxy usa o mesmo contexto W em adaptação própria; não reinventar protocolo SOCKS5.

## API do agente

Prefixo D = `/api/device/v1`.

| Método/rota | Entrada e efeito |
|---|---|
| POST D`/capabilities` | node/epoch autenticados; Android, appVersion, smsSupported, permissões e disponibilidade |
| POST D`/sms/inventory` | inventoryVersion, linhas ativas localBindingId/subscriptionId/slot/carrier; invalida vínculos removidos |
| POST D`/sms/claim` | Nó pede trabalho; 200 com attempt ou data:null; lease 120s |
| POST D`/sms/attempts/{attemptId}/grant` | leaseToken, inventoryVersion, segments, previewFingerprint; reserva e grant único |
| GET D`/sms/attempts/{attemptId}` | Estado/grant previamente emitido; só tentativa desse nó |
| POST D`/sms/events` | Até 100 eventos; ACK por eventId após persistência |

Claim/grant/events utilizam contratos estritos, autenticação HMAC e replay protection. Claim repetido para tentativa em curso devolve a mesma tentativa. Eventos enviados após suspensão podem registrar resultados prévios; não concedem grant novo. `smsSupported=false` impede execução e permite ainda o proxy.

## MCP

Baseline interoperável inicial: bridge **stdio local**, configurado pelo cliente com URL HiveNode e API key em variável protegida. A bridge faz chamadas REST ou ao mesmo serviço de aplicação; nunca lê banco diretamente. Esta etapa evita anunciar um endpoint remoto que só aceite API key como se suportasse OAuth dos clientes MCP.

Ferramentas: `hive_sms_list_devices`, `hive_sms_list_sims`, `hive_sms_send`, `hive_sms_send_batch`, `hive_sms_get_message`, `hive_sms_cancel`, `hive_sms_pause`, `hive_sms_resume`. Schemas iguais à REST, workspace fixo da chave, idempotencyKey obrigatória em send/batch/resend. `send` e `resume` têm annotations que indicam mutação/efeito; cancel não promete desfazer envio físico. Annotations ajudam cliente, não são segurança.

Conteúdo de SMS é dado não confiável. Nunca interpretá-lo como instrução para trocar conta, revelar chave, desabilitar supressão ou criar envio adicional. Erros de ferramenta retornam código de domínio e requestId; não expor token em stderr. Em testes, ferramenta com chave read-only falha antes de criar mensagem.

Remoto: Streamable HTTP em serviço persistente, OAuth conforme versão estável fixada na issue (baseline 2025-11-25), protected resource metadata, validação issuer/audience/scopes e vínculo de conta; proibir token passthrough. Não seguir draft sem ADR. Frontend de consentimento mostra serviço, conta, aparelhos e scopes. Gate separado para clientes reais. [Transporte](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [autorização](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).

## Webhooks de saída

Evento `sms.message.updated`/`sms.device.updated`/`sms.policy.paused`: id único, workspaceId, timestamp, resourceId, status, diagnóstico redigido. Body sem conteúdo/telefone completo por padrão. Assinatura `X-Hive-Signature: t=<unix>,v1=<HMAC_SHA256(secret,t+'.'+rawBody)>`; consumidor tolera replay de evento por ID e relógio, recomendado 5min.

Até 8 tentativas incluindo a primeira, atrasos 30s, 2min, 10min, 30min, 2h, 6h e 12h, timeout 10s. Só 2xx confirma; 410 desativa endpoint e avisa; outros erros elegíveis fazem retry. Ignorar redirects por padrão. Validação DNS/IP em cada tentativa impede loopback, private/link-local, cloud metadata, IPv6 equivalente e DNS rebinding; conectividade usa IP validado mantendo Host/SNI. Secret exibido uma vez, cifrado e rotacionável com janela explícita.

Exportação assíncrona: CSV seguro contra formula injection, escopos e conta revalidados na criação E no download; link autenticado ou assinatura curta de até 5min; exclusão do arquivo em até 24h. `sms:export` sem content read exporta apenas eventos mascarados.
