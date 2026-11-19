# Plano de entrega, operação e rollback

## Sequência

| Fase | Entrega | Saída exigida |
|---|---|---|
| 0 — Viabilidade | HNS-01, 02, 03, 35 | Prova do canal Android, sandbox financeiro e testes isolados em paralelo |
| 1 — Fluxo vertical | HNS-04, 06, 08, 10, 11, 13, 15–18, 23, 24, 26, 37 | OWNER, pareamento SMS-only, fila Postgres, simulação E2E e Android principal |
| 2 — Piloto assistido | HNS-29, 30, 32–34 | Medição, Android principal homologado, controles de linha, privacidade e pausa |
| 3 — Piloto pago | HNS-12, 38 | Inicial, um meio mensal confirmado, cancelamento e receita conciliados |
| 4 — Expansão | HNS-05, 07, 09, 14, 19–22, 25, 27, 28, 31, 36 | Aceites próprios por capacidade, migração progressiva e dispositivos homologados |

Issues contêm dependências mais precisas que estes intervalos. Não comprometer datas sem disponibilidade do time. Junior implementa partes pequenas com revisão; responsabilidade jurídica, arquitetura de execução e produção têm responsável experiente.

## Ambientes

- Local/test: Docker isolado, provider fake, fake modem, destinos fictícios, appEnv=test, realSend=false.
- Staging: banco próprio, sandbox pagamento, APK debug/controlado, grant real ainda desligado por padrão.
- Piloto físico: allowlist de contas/nós/linhas aprovadas e destinos controlados; activation auditada.
- Produção: allowlist inicial, flags + política/entitlement + confirmação local; limites publicados.

Variáveis A CRIAR/documentar no `.env.example` sem segredo real: flags da arquitetura, SMS_GRANT_PRIVATE_KEY/KID e chaves públicas, SMS_LOOKUP_HMAC_KEY, política de limite/retention, URLs do agente, webhook signing, MCP upstream/base/auth e observability. Não duplicar JWT_SECRET como todas as chaves. Não usar chave de teste em produção.

## Métricas e alertas

Métricas por ambiente/serviço e IDs técnicos controlados: mensagens por estado, grants, diferença claim→grant→sent, UNKNOWN/PARTIAL, retries seguros, reconciliação atrasada, outbox lag, DLQ, webhook falhas, tempo fila, dispositivos disponíveis, suspensões e receita/custos efetivos. Não anexar conteúdo/telefone completo como labels; evitar cardinalidade infinita por destinatário.

Defaults de investigação do piloto: atraso de conciliação acima de dois minutos, fila fora da validade e crescimento de UNKNOWN/PARTIAL por modelo. Volumes pequenos mostram contagem. Medir consultas ociosas, atraso fila→modem, bateria, dados, tempo até primeiro envio, conversão, renovação e minutos de suporte. Produto e Financeiro definem coorte e metas antes de convidar clientes. Duplicação física ou falha de isolamento interrompe a expansão. Separar resultados reais e simulados. Outbox lag passa a ser acompanhado quando webhooks estiverem ativos.

Runbooks: aparelho offline; permissão/SIM; erro de rede ambíguo; atraso de outbox; fila indisponível; webhook; pagamento fora de ordem; perda de chave; vazamento de dados; migração inconsistente; rollback compatível. Nenhum runbook recomenda trocar chip para burlar bloqueio ou repetir UNKNOWN automaticamente.

## Kill switch

1. Desabilitar `SMS_REAL_SEND_ENABLED` global ou suspender conta/linha em transação auditada.
2. PostgreSQL preserva intenção e estado. O worker continua a conciliação e novos grants são bloqueados.
3. App pode finalizar grant previamente emitido até exp, por no máximo 30s; expor essa janela, sem alegar recall de modem.
4. Eventos/receipts/ACK continuam aceitos para conciliação; webhooks e leitura autorizada continuam operando.
5. Retomada exige revisar política, validade e mensagens suspensas; nunca flush indiscriminado de fila acumulada.

## Rollout

Criar contas do piloto de forma aditiva e preservar as rotas de proxy. Executar simulador e homologar o APK principal. Após HNS-34, conceder SMS Beta só a contas selecionadas em Administração → Usuários. Exigir admissão no painel, REST, MCP, pareamento e novas autorizações de modem. A linha e o destino mantêm autorizações independentes. Liberar compra no plano Inicial após HNS-38 e somente para o beta admitido. Aplicar migração em shadow e ensaio de restauração antes de habilitar equipe sobre o proxy. Light e abertura pública têm aceites próprios. [Beta privado](16-beta-privado.md).

## Rollback

- Funcional: desligar SMS, manter ingestão e direito pago/proxy; não apagar mensagens/attempts.
- Código: retornar versão compatível com workspace e schemas novos. Antiga versão user-only não é rollback seguro após dados novos de equipe.
- Banco: restauração de ensaio; após restore reconciliar pagamentos, grants/attempts emitidos e supressões. Não repetir modem a partir de intenção antiga restaurada.
- APK: política de versão mínima SMS por capabilities; versão antiga sem executor continua proxy. Não fazer downgrade de binary que reexecuta inbox.
- Chaves: rotação versionada com janela; revogar credenciais/grants conforme incidente. Não imprimir segredos durante diagnóstico.

## Checklist para release

- [ ] R01–R22 rastreados. T01–T61 executados conforme a fase, com pendências e evidências visíveis.
- [ ] Rollback e recuperação SMS ensaiados para o piloto. Antes da expansão do proxy, executar HNS-31 com backfill idempotente e backup restaurado.
- [ ] Testes regressivos de proxy/apps antigos e cobrança passaram.
- [ ] Nenhuma chance conhecida de acesso entre contas ou retry cego sem correção.
- [ ] Gate físico principal aprovado; Light aprovado ou flag Light SMS desligada e status público explícito.
- [ ] Linhas do piloto elegíveis; termos/privacidade/contratos revistos.
- [ ] Distribuição e requisitos de linha validados no piloto assistido. Para cobrar, validar gateway real, limites, custos e preço conforme HNS-38.
- [ ] Suporte, alertas, kill switch e responsáveis de plantão definidos.
- [ ] Artefatos/commits dos repositórios próprios referenciados e APK hash registrado.

## Definition of Done por issue/PR

Problema e comportamento resultante, arquivos alterados, decisão de compatibilidade, testes relevantes/evidência, casos negativos, riscos e rollback. Sem secrets/dados reais. Mudança que requer aparelho marca gate P pendente e não se descreve como validada em rede real. PR de migração inclui relatório de contagem/saldo. PR de auth inclui matriz de acesso. PR de modem inclui crash/replay/multipart.
