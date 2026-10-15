# Decisões, pendências e referências

## Baseline aceito na conversa

| ID | Decisão |
|---|---|
| D01 | SMS somente aparelhos/linhas da própria conta; nada de pool entre clientes |
| D02 | Cliente responde por decisões de uso; HiveNode conserva obrigações próprias |
| D03 | Todos os públicos; preço de entrada acessível |
| D04 | Mensalidade por aparelhos, sem tarifa HiveNode por mensagem; chip/operadora pagos pelo cliente |
| D05 | Proposta de R$19,90/49,90/99,90 para 1/5/15 aparelhos; benefício 1/3/10 membros |
| D06 | Equipe única para plataforma; maior benefício ativo, nunca soma |
| D07 | SMS/proxy separados em cobrança/permissões; mesmos login, painel e apps |
| D08 | Estados e recuperação transparentes; nenhuma promessa de resolver toda falha |
| D09 | App será homologado fisicamente pelo proprietário daqui a alguns dias |

D05 é baseline para especificação após aceite de seguir recomendações; lançamento continua dependendo de custos. Benefícios de membros dos planos proxy atuais não foram definidos: baseline conservador 1 preserva operação atual até revisão do catálogo.

## Decisões técnicas propostas para execução

T-D01: controle SMS HTTPS independente de túnel proxy. T-D02: grant curto antes do modem e inbox nativo persistente. T-D03: broker mantém binário TCP e migra contexto para conta. T-D04: SDK54 fixo, SMS API>=26, Light modernizado e antigo proxy-only. T-D05: MCP stdio inicial e remoto OAuth condicionado. T-D06: descadastro por link v1; recebimento nativo fora do lançamento. T-D07: dois chips serializados por aparelho, sem failover automático. T-D08: body retention 7d pós-terminal, limites e configuração descritos nos specs.

Essas decisões tornam o trabalho concreto; revisão técnica pode alterá-las por ADR, atualizando contratos, issues, teste e PRD juntos. Não alterar só o código e deixar um junior seguindo documento contraditório.

## Pendências que bloqueiam lançamento, não a escrita de código

| Pendência | Responsável esperado | Saída |
|---|---|---|
| Sustentabilidade dos preços | Produto/financeiro | Custo efetivo e catálogo liberado |
| Autorização de cada tipo de linha/plano | Cliente + compliance/comercial | Evidência e política elegível |
| Termos/LGPD/enquadramento | Jurídico habilitado | Documentos e instruções revisados |
| Canal de distribuição SMS | Produto/mobile | Play elegível ou distribuição empresarial definida |
| Estratégia FGS/target/latência | Mobile sênior | ADR por versão Android, teste físico e limites publicados |
| Billing upgrade/cancelamento/recorrência | Backend/financeiro | Spike de API real/sandbox e adaptação |
| Carga/capacidade | Infra/backend | Benchmark do ambiente e limites públicos |
| Homologação aparelho | Proprietário + mobile | Gate P com build/modelo/linha e resultados |
| MCP remoto | Integrações/security | OAuth e teste com clientes reais antes de oferta remota |

## Fontes consultadas

Consultadas em 13/10/2026. Conferir novamente ao implementar/publicar; não copiar regras antigas automaticamente. Fontes de terceiros comerciais servem somente a benchmark, não a parecer jurídico brasileiro.

- [Android SubscriptionManager](https://developer.android.com/reference/android/telephony/SubscriptionManager): assinaturas ativas, permissões e número não garantido.
- [Android SmsManager](https://developer.android.com/reference/android/telephony/SmsManager): seleção de subscription, segmentos e callbacks.
- [Foreground service timeouts](https://developer.android.com/develop/background-work/services/fgs/timeout): limites de execução em Android moderno.
- [Expo SDK54](https://docs.expo.dev/versions/v54.0.0/): matriz de versões e toolchain.
- [Expo Modules](https://docs.expo.dev/modules/get-started/): módulo nativo/build próprio.
- [Google Play — SMS](https://support.google.com/googleplay/android-developer/answer/10208820): permissões restritas e declaração.
- [Apple MessageUI](https://developer.apple.com/documentation/messageui/mfmessagecomposeviewcontroller): interface com confirmação da pessoa; gateway automático fora do escopo.
- [BullMQ IDs](https://docs.bullmq.io/guide/jobs/job-ids) e [idempotência](https://docs.bullmq.io/patterns/idempotent-jobs): limites de dedup da fila.
- [Prisma transactions](https://www.prisma.io/docs/orm/fundamentals/transactions): transações e concorrência.
- [MCP 2025-11-25 transporte](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) e [autorização](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization): baseline estável projetado, não draft.
- Next.js da versão instalada: `web/node_modules/next/dist/docs/`; ler route handlers, cookies, proxy e convention route antes do código.
- [LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), [CDC](https://planalto.gov.br/ccivil_03/leis/l8078compilado.htm), [LGT](https://www.planalto.gov.br/ccivil_03/leis/l9472.htm).
- [ANPD agentes de tratamento](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado), [legítimo interesse](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_de_dados_pessoais_legitimo_interesse).
- [Claro condições gerais](https://www.claro.com.br/files/104379/x/b7ba5cabff/condicoes-gerais-de-contratacao-pf_site.pdf), [Vivo termo empresarial](https://vivo.com.br/content/dam/vivo-sites/vivo-com-br/para-empresas/pdf/produtos-e-servicos/servicos-essenciais/movel/Termo_Servico_Movel_Pessoal.pdf). Sem contrato específico, não afirmar aprovação de plano TIM/Claro/Vivo.
- [TextBee preços](https://textbee.dev/pricing) e [SMS Gate gratuito](https://docs.sms-gate.app/pricing/): referências de mercado, preços sujeitos a mudança; não importam permissões de operadora.

## Regra para mudanças

Registrar ADR com decisão, motivo, alternativas, compatibilidade, custo, testes e documentos afetados. Alterações de preço/benefícios não mudam snapshot de contratos vigentes. Alteração de retenção/política informa clientes e exige revisão da finalidade. Mudança de contrato público exige versão e novo aceite quando aplicável.
