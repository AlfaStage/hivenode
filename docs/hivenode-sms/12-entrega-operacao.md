# Plano de entrega, operação e rollback

## Sequência

| Fase | Entrega | Saída exigida |
|---|---|---|
| 0 — Fundamentos | HNS-01–HNS-03, investigação FGS/gateway, fixtures | Contratos/decisões verificáveis, baseline e simulator-ready |
| 1 — Equipes | HNS-04–HNS-10 | Migração aditiva, autorização, convites, proxy/realtime sem regressão |
| 2 — Comércio e políticas | HNS-11–HNS-14 | Catálogo, trial, lifecycle de billing e linha elegível |
| 3 — Backend SMS | HNS-15–HNS-22 | REST, outbox, claim/grant, estados, webhooks/exports |
| 4 — Apps/canais | HNS-23–HNS-28 | Módulo principal, Light, UX, MCP, builds |
| 5 — Release | HNS-29–HNS-34 | Observabilidade, CI, homologação, operação e gates comerciais |

Issues contêm dependências mais precisas que estes intervalos. Não comprometer datas sem disponibilidade do time. Junior implementa partes pequenas com revisão; responsabilidade jurídica, arquitetura de execução e produção têm responsável experiente.

## Ambientes

- Local/test: Docker isolado, provider fake, fake modem, destinos fictícios, appEnv=test, realSend=false.
- Staging: banco próprio, sandbox pagamento, APK debug/controlado, grant real ainda desligado por padrão.
- Piloto físico: allowlist de contas/nós/linhas aprovadas e destinos controlados; activation auditada.
- Produção: allowlist inicial, flags + política/entitlement + confirmação local; limites publicados.

Variáveis A CRIAR/documentar no `.env.example` sem segredo real: flags da arquitetura, SMS_GRANT_PRIVATE_KEY/KID e chaves públicas, SMS_LOOKUP_HMAC_KEY, política de limite/retention, URLs do agente, webhook signing, MCP upstream/base/auth e observability. Não duplicar JWT_SECRET como todas as chaves. Não usar chave de teste em produção.

## Métricas e alertas

Métricas por ambiente/serviço e IDs técnicos controlados: mensagens por estado, grants, diferença claim→grant→sent, UNKNOWN/PARTIAL, retries seguros, reconciliação atrasada, outbox lag, DLQ, webhook falhas, tempo fila, dispositivos disponíveis, suspensões e receita/custos efetivos. Não anexar conteúdo/telefone completo como labels; evitar cardinalidade infinita por destinatário.

Defaults de piloto para investigação, não SLA: outbox lag >60s por 5min; reconciliação sem heartbeat >2min; eventos UNKNOWN/PARTIAL >1% em 15min com pelo menos 100 tentativas; estado degradado de DB/Redis imediato para novos grants. Volumes pequenos mostram contagem, não percentuais enganosos. Dashboards devem separar resultado sintético e real.

Runbooks: aparelho offline; permissão/SIM; erro de rede ambíguo; atraso de outbox; fila indisponível; webhook; pagamento fora de ordem; perda de chave; vazamento de dados; migração inconsistente; rollback compatível. Nenhum runbook recomenda trocar chip para burlar bloqueio ou repetir UNKNOWN automaticamente.

## Kill switch

1. Desabilitar `SMS_REAL_SEND_ENABLED` global ou suspender conta/linha em transação auditada.
2. Publisher/worker continuam guardando intent/estado; emitir novos grants fica proibido.
3. App pode finalizar grant previamente emitido até exp, por no máximo 30s; expor essa janela, sem alegar recall de modem.
4. Eventos/receipts/ACK continuam aceitos para conciliação; webhooks e leitura autorizada continuam operando.
5. Retomada exige revisar política, validade e mensagens suspensas; nunca flush indiscriminado de fila acumulada.

## Rollout

Não promover todos os clientes de uma vez. Primeiro migração em shadow e equipe de piloto; depois simulador backend; depois APK principal com teste físico; Light somente após gate próprio; por fim público com linhas elegíveis. Catálogo público pode ficar desativado até L/P. Cliente já pagante não ganha SMS por acaso ao alterar um enum.

## Rollback

- Funcional: desligar SMS, manter ingestão e direito pago/proxy; não apagar mensagens/attempts.
- Código: retornar versão compatível com workspace e schemas novos. Antiga versão user-only não é rollback seguro após dados novos de equipe.
- Banco: restauração de ensaio; após restore reconciliar pagamentos, grants/attempts emitidos e supressões. Não repetir modem a partir de intenção antiga restaurada.
- APK: política de versão mínima SMS por capabilities; versão antiga sem executor continua proxy. Não fazer downgrade de binary que reexecuta inbox.
- Chaves: rotação versionada com janela; revogar credenciais/grants conforme incidente. Não imprimir segredos durante diagnóstico.

## Checklist para release

- [ ] R01–R22 rastreados; T01–T54 com evidência e gates pendentes visíveis.
- [ ] Backup restaurado, migração idempotente e rollback compatível ensaiados.
- [ ] Testes regressivos de proxy/apps antigos e cobrança passaram.
- [ ] Nenhuma chance conhecida de acesso entre contas ou retry cego sem correção.
- [ ] Gate físico principal aprovado; Light aprovado ou flag Light SMS desligada e status público explícito.
- [ ] Linhas do piloto elegíveis; termos/privacidade/contratos revistos.
- [ ] Gateway/distribuição real validados; limites/preços publicados e custos aceitos.
- [ ] Suporte, alertas, kill switch e responsáveis de plantão definidos.
- [ ] Artefatos/commits dos repositórios próprios referenciados e APK hash registrado.

## Definition of Done por issue/PR

Problema e comportamento resultante, arquivos alterados, decisão de compatibilidade, testes relevantes/evidência, casos negativos, riscos e rollback. Sem secrets/dados reais. Mudança que requer aparelho marca gate P pendente e não se descreve como validada em rede real. PR de migração inclui relatório de contagem/saldo. PR de auth inclui matriz de acesso. PR de modem inclui crash/replay/multipart.
