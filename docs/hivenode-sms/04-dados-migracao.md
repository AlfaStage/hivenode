# Dados, integridade e migração

## Modelo conceitual (A CRIAR)

Não copiar esta tabela como uma migração automática. Traduzir para Prisma + SQL, revisar FKs/índices e ensaiar antes de produção. IDs são UUID salvo IDs externos. Dinheiro é Int centavos; bytes/segmentos agregados BigInt; datas UTC; status enums; textos cifrados em coluna separada.

| Entidade | Campos essenciais | Unicidade/índices |
|---|---|---|
| Workspace | id, name, kind CUSTOMER/SYSTEM, migratedFromUserId?, authorizationVersion, createdAt | migratedFromUserId unique |
| Membership | id, workspaceId, userId, role, status, invitedBy?, joinedAt, suspendedReason? | workspaceId+userId unique; status por workspace |
| MembershipGrant | membershipId, service, permission, nodeId? | grant canônico unique; node da mesma conta |
| WorkspaceInvitation | id, workspaceId, emailNormalized, tokenHash, expiresAt, status, role, grantsSnapshot | tokenHash unique; convites pendentes por conta/email |
| DeviceService | nodeId, workspaceId, service, enabled, enabledAt, policyVersion | nodeId+service unique; conta+serviço+enabled |
| SimBinding | id, workspaceId, nodeId, installationEpoch, localBindingId, inventoryVersion, label, carrierName?, slot?, subscriptionId?, status, verifiedNumberCiphertext?, numberLookupHash? | node+epoch+localBindingId unique; conta+status |
| SimPolicy | id, simBindingId, version, eligible, allowedPurposes, segmentRate, periodCap?, roamingAllowed, evidenceRef?, approvedBy, expiresAt? | sim+version unique; política não é parecer automático |
| TermsAcceptance | id, workspaceId, userId, documentVersion, documentHash, acceptedAt, evidenceMetadata | conta+user+version unique |
| ApiCredential | id, workspaceId, createdByMembershipId, tokenHash, prefix, scopes, allowedNodeIds, expiresAt?, revokedAt? | tokenHash unique; conta+prefix |
| SmsMessage | id, workspaceId, nodeId, simBindingId, purpose, recipientCiphertext, recipientLookupHash, bodyCiphertext, state, stateVersion, scheduledAt, expiresAt, actorMembershipId?, credentialId?, createdAt, terminalAt?, bodyPurgeAt | conta+createdAt+id; sim+state+scheduledAt |
| SmsBatch | id, workspaceId, actor, schedule, createdAt | conta+createdAt |
| SmsBatchItem | batchId, messageId, clientItemId | batch+clientItemId unique; message unique |
| IdempotencyRecord | workspaceId, operation, keyHash, requestFingerprint, resourceId, createdAt, expiresAt | conta+operação+keyHash unique |
| SmsAttempt | id, messageId, workspaceId, nodeId, simBindingId, index, state, executionMode REAL/SIMULATED, leaseTokenHash, fencingToken, grantId?, segmentCount?, dispatchStartedAt?, lastEventAt, retrySafe? | message+index unique; grantId unique |
| SmsSegmentResult | attemptId, segmentIndex, sendState, deliveryState, platformResultCode?, occurredAt | attempt+segmentIndex unique; índice começa em 0 |
| SmsDeviceEvent | id, workspaceId, nodeId, attemptId?, installationEpoch, eventType, deviceSequence, receivedAt, metadataRedacted | node+epoch+deviceSequence unique; id unique |
| SmsSuppression | workspaceId, recipientLookupHash, purpose MARKETING, source, createdAt | conta+destinatário+purpose unique |
| SmsOptOutToken | tokenHash, workspaceId, recipientLookupHash, expiresAt?, consumedAt? | tokenHash unique; nada de telefone em URL |
| SmsOutbox | id, workspaceId, kind, aggregateId, payloadVersion, availableAt, publishedAt?, attempts | pending+availableAt; payload sem corpo claro |
| SmsWebhookEndpoint | id, workspaceId, url, signingKeyCiphertext, active, eventTypes | conta+active |
| SmsWebhookDelivery | id, endpointId, eventId, state, attemptCount, nextAt, responseCode? | endpoint+event unique |
| ServiceEntitlement | workspaceId, service, sourceSubscriptionId?, revision, deviceLimit, memberBenefit, historyDays, validUntil, executionAllowed | conta+service unique |
| TrialSegmentReservation | id, workspaceId, trialId, attemptId, count, state RESERVED/CONSUMED/RELEASED | attempt unique; trial+state |
| SmsTrial | id, workspaceId, initialOwnerId, startsAt, expiresAt, maxSegments, status | workspaceId unique; owner inicial para controle de abuso |
| SmsTemplate | id, workspaceId, name, version, textCiphertext, purpose, variables, active | conta+name+version unique |
| SmsExport | id, workspaceId, actorMembershipId, filtersRedacted, includeContent, state, objectRef?, expiresAt | conta+createdAt; storage referência protegida |
| WorkspaceBillingAccount | workspaceId, providerCustomerId?, balanceGB, ownerBillingContactId | workspace unique; customerId unique quando aplicável |
| Subscription/Payment/AuditLog | adicionar workspaceId, serviço/snapshot/ator conforme contexto | preservar IDs externos únicos e histórico |

`purpose` distingue MARKETING, TRANSACTIONAL e INTERNAL; seleção não torna finalidade lícita. Textos de template também são cifrados e têm limite/tamanho. Número de destino normalizado E.164, hash HMAC com chave própria para lookup; hash simples de telefone facilita enumeração. Não usar ICCID/IMEI como identidade obrigatória nem armazenar identificadores restritos sem necessidade.

## Invariantes do banco e aplicação

1. Toda entidade de cliente tem workspaceId obrigatório após contract; FKs compostas impedem referenciar nó, SIM, mensagem ou membership de outra conta.
2. Deve existir exatamente um OWNER ACTIVE por conta CUSTOMER. Índice único parcial para proprietário e transação com lock da conta para transferência. Nunca remover o último proprietário.
3. Node pertence a uma conta; memberships dão acesso, não mudam a propriedade para o funcionário.
4. SIM pertence ao nó e à mesma conta. SMS exige nó BYOD PRIVATE e instalação compatível; conversão para PUBLIC é rejeitada enquanto SMS estiver habilitado.
5. Não conceder SMS por shares. Vinculação nova invalida tentativas/claims anteriores conforme protocolo, nunca autoriza outro aparelho a repetir uma tentativa iniciada.
6. Uma tentativa ativa por mensagem e, inicialmente, uma execução/grant ativo por aparelho, mesmo com dois chips. Índices parciais e locks garantem isso.
7. Unique de idempotência resolve corrida; erro de unique deve retornar o recurso existente quando fingerprint é igual.
8. Inserção mensagem + idempotência + outbox + auditoria ocorre em uma transação. Publisher reexecutável não cria intenção adicional.
9. Atualizar estado usa compare-and-swap `stateVersion`; evento duplicado preserva mesma resposta e não reconta segmentos.
10. Nenhuma exclusão de User deve apagar cascata de dados de uma empresa onde existam outros membros. Trocar FKs/cascades com revisão.

## Migração expand → backfill → transição → contract

### A. Preparar

- Inventariar todos os leitores/escritores de userId em API, worker, proxy, broker, billing, dashboard tickets, apps, CLI, HiveDocker e Miner.
- Separar responsabilidade GLOBAL ADMIN de OWNER/MEMBERSHIP. Não convidar usuários para conta administrativa SYSTEM.
- Comparar banco real com histórico de migrations. O projeto já documenta necessidade de baseline para bancos criados por `db push`; não executar migration inicial por cima das tabelas existentes.
- Backup, restauração de ensaio e contagens por tabela/cliente; incluir shares, frota pública, saldo, pagamentos, convites inexistentes e nós sem proprietário.

### B. Expand aditivo

Criar tabelas e campos workspaceId inicialmente nullable. Campos novos não alteram o comportamento dos clients antigos. Criar índices de maneira apropriada ao tamanho do banco e transações suportadas; índice concorrente PostgreSQL exige operação separada. Nenhuma remoção de coluna ou reset de banco.

### C. Backfill idempotente

Para cada CUSTOMER existente, criar Workspace com migratedFromUserId unique e membership OWNER ACTIVE. Para recursos do administrador, usar conta SYSTEM explícita onde adequado; órfãos viram relatório para decisão, nunca são atribuídos arbitrariamente a um cliente.

Vincular nós, assinaturas, pagamentos, credenciais proxy e eventos à conta do proprietário/contratante correto. `NodeShare` continua ligando dono e beneficiário: mapear cada usuário para sua conta padrão, preservando duas contas diferentes, jamais fundi-las. Créditos proxy existentes passam para billing da conta padrão; snapshots e somas conciliam com os valores anteriores.

Executar em lotes com cursor/checkpoint, registrar contagem por conta, repetir e verificar que IDs e quantidades não mudam. Não gerar novas cobranças ou renovar assinatura durante o backfill.

### D. Compatibilidade controlada

- Uma camada central resolve user legado → conta padrão e membership. Cliente novo escolhe workspace explicitamente; token de pessoa continua identificando pessoa.
- Cadastro de cliente novo cria a conta padrão e OWNER na mesma transação do usuário; não depender de rodar backfill novamente para cada cadastro. Novas contas adicionais por pessoa são extensão posterior; agências ingressam nas contas dos clientes por convite.
- APIs legadas recebem somente a conta padrão compatível; não selecionam uma conta arbitrária. App legado continua vinculado ao nó já registrado.
- Novo saldo da conta e campos shadow legados são atualizados na mesma transação, por helper central; documentar fonte canônica. Nenhum serviço escreve saldo antigo diretamente depois da transição.
- Broker consulta conta/membership/entitlements pela API interna. Mantém formato de credencial SOCKS5 e protocolo binário; dono/ator não são confundidos.
- Habilitar equipe por allowlist. Comparar decisão antiga/nova em shadow sem liberar acesso extra. Migrar leitura somente após divergências explicadas.
- Se funcionário sair, não apagar aparelho nem assinatura. Revogar grants pessoais e chaves derivadas conforme spec.

### E. Contract

Só após cobertura dos leitores, APK/CLI compatíveis, ensaio de restauração e janela de compatibilidade concluída: workspaceId NOT NULL onde cabível, remover fallback e, em entrega posterior, campos shadow obsoletos. Não misturar contract com a primeira ativação SMS.

## Verificações SQL conceituais

Contagens exigidas: usuários clientes com uma conta padrão; contas com um OWNER; recursos de cliente sem workspace = 0; FKs entre contas = 0; saldoGB antes/depois igual por conta; somas de pagamentos iguais; share aceito mantém acesso proxy e não concede SMS; status/prazo das assinaturas não mudam sem evento financeiro.

Testar duas instâncias do backfill simultâneas, queda após checkpoint, rollback de lote, usuário com vários serviços, usuário membro de duas contas e retenção de histórico após remoção de membership.

## Rollback de migração

Antes de tráfego novo: desligar flag, reverter leitura à conta padrão, preservar colunas/tabelas aditivas. Depois de equipes criarem dados, rollback para código que só entende userId pode atribuir recursos incorretamente: usar versão de compatibilidade ou modo somente leitura, nunca restaurar backup antigo descartando dados novos sem plano explícito.

Referência de transações: [Prisma](https://www.prisma.io/docs/orm/fundamentals/transactions). A estratégia acima é decisão do HiveNode, não garantia automática da biblioteca.
