# Segurança, privacidade e conformidade

## Responsabilidades e liberação da linha

Contrato atribui ao cliente conteúdo, destinatários, finalidade, base legal dos contatos e cumprimento das condições da linha. HiveNode conserva obrigações próprias de segurança, tratamento de dados e execução do serviço. Aceite não altera contrato de operadora nem constitui exoneração total. Revisão jurídica é entrega de responsável habilitado, não tarefa de um dev júnior. [LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), [CDC](https://planalto.gov.br/ccivil_03/leis/l8078compilado.htm).

Linha real precisa de autorização contratual para finalidade/automação, evidência identificável e política com limites. Checkbox de responsabilidade sozinho não muda SimPolicy para eligible. Aceitar planos pré-aprovados por contrato aplicável ou análise documentada. Definir custo/tempo dessa verificação no piloto; preço barato não remove este gate. [Claro](https://www.claro.com.br/files/104379/x/b7ba5cabff/condicoes-gerais-de-contratacao-pf_site.pdf), [Vivo Empresas](https://vivo.com.br/content/dam/vivo-sites/vivo-com-br/para-empresas/pdf/produtos-e-servicos/servicos-essenciais/movel/Termo_Servico_Movel_Pessoal.pdf).

Cliente tende a ser controlador da campanha e HiveNode operador nessa execução; dados de conta/cobrança podem ter papel diferente. Papéis dependem dos fatos. Documentar instruções, subprocessadores, pedidos de titulares e incidentes. Não afirmar que todo marketing sempre exige a mesma base legal ou que legítimo interesse autoriza qualquer envio. [ANPD — agentes](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado).

## Conteúdo e descadastro

- Marketing v1 exige evidência de adesão e identidade do remetente como política do produto, além da análise jurídica aplicável.
- Incluir link de descadastro tokenizado por destinatário/conta, URL HTTPS sob domínio configurado. Não usar `SAIR` como única saída sem recepção nativa implementada.
- GET apenas exibe confirmação, porque scanners de links podem visitar URLs. POST efetiva supressão idempotente sem exigir login.
- Supressão vale marketing em toda a conta, todos os aparelhos/chips, inclusive fila existente. Revalidar imediatamente antes do grant.
- Mensagem transacional não contorna supressão disfarçando propaganda; finalidade deve corresponder ao conteúdo e relacionamento.
- Reinscrição exige evidência nova e ação auditada; não permitir importação CSV apagar supressão.
- Não rodar filtros/LLMs sobre conteúdo sem consentimento/processo adequado. V1 usa regras explícitas, denúncias e intervenção operacional.

## Retenção

| Dado | Baseline projetado |
|---|---|
| Corpo/destino completo necessário ao envio | Enquanto pendente dentro de agenda/validade; depois 7 dias da conclusão, máximo 30 da criação |
| Histórico operacional visível | 30/90/180 dias conforme plano, sem implicar retenção do corpo |
| Arquivo de exportação | Até 24h, acesso curto/revalidado |
| Idempotência/tombstone de execução | 180 dias, hashes/fingerprints mínimos; informar janela |
| Supressões | Enquanto necessárias para respeitar a oposição/descadastro, com revisão da finalidade |
| Evidências de contrato/aceite/financeiro/auditoria | Prazo definido pelo jurídico por finalidade; não apagar por downgrade do plano |

O job de retenção remove corpo do DB, filas, eventos indevidos, exports e armazenamento local; backup tem expiração/controle próprio e restauração reaplica supressões/retenção. Crypto-shredding não é desculpa para continuar exibindo texto em caches. Pedido de exclusão não apaga evidência obrigatória sem análise de finalidade/base legal. Legal hold é registrado com responsável e escopo, não ativado indefinidamente em todas as contas.

## Controles técnicos

1. TLS externo; endpoints internos com autenticação dedicada; segmentation de rede e credenciais mínimas.
2. API key aleatória forte, hash no servidor, prefixo público, scopes/resources, expiração e rotação. Segredo completo exibido uma vez.
3. Corpo cifrado com encryption key versionada; lookup de número por HMAC com key própria. Não reutilizar chave JWT para tudo.
4. Sem texto/telefone completo em logs, traces, URLs, fila BullMQ, alertas, analytics, dumps de teste ou captura de tela compartilhada.
5. Revalidar acesso ao ler, exportar, assinar download e emitir evento realtime; remover membro invalida permissões.
6. Limitar tamanho/batch, sanitizar CSV contra formula injection, CSRF em cookie, CORS explícito.
7. Webhooks com defesa SSRF inclusive resolução/rebinding/IPv6; impedir endpoint da própria rede interna.
8. Rate limits distinguem cliente/permissão/linha. Não usar rotação de chips para driblar bloqueio.
9. Painel administrativo registra intervenções; admin global não tem botão irrestrito de SMS por qualquer cliente.
10. Dependências fixadas/atualizadas deliberadamente; build APK sem secret financeiro, private signing key ou credencial interna de servidor.

## Modelo de ameaças obrigatório

| Ameaça | Controle e evidência |
|---|---|
| IDOR entre contas | Queries scoped + FKs compostas + T03/T04 |
| Replay de request/grant | Nonce, timestamp, eventId, fencing e inbox local + T21/T27 |
| Funcionário revogado | Membership check no grant, chave derivada suspensa + T06 |
| SIM trocado mantendo slot | Epoch/binding/inventory version e confirmação + T30 |
| Retry cego após crash | INVOKING persistido, UNKNOWN e reconciliação + T24/T25 |
| DNS rebinding em webhook | Validar IP da conexão, sem redirect + T38 |
| Prompt injection no conteúdo | Conteúdo nunca vira instrução de MCP + T36 |
| Vazamento em export/log | Escopo/cifra/redaction/CSV + T39/T40 |
| Fraude de teste/preço | Quota transacional, gateway validado, nenhum self-grant + T10/T14 |
| Mistura frota pública/SMS | BYOD PRIVATE ownership obrigatório + T04/T45 |

## Operação de abuso/incidentes

Canal de denúncia com requestId/messageId, classificação, evidência mínima, responsável e prazo operacional publicado. Suspeita pode pausar novos grants da linha/conta; preservar histórico necessário e permitir contestação. Não afirmar culpa ou causa técnica sem evidência. Incidente de dados segue plano jurídico/ANPD aplicável; dev não envia comunicação externa por conta própria.

Antes do lançamento: termos específicos SMS, política de privacidade, contrato de tratamento, regras de uso, procedimento de descadastro, condições de suporte, limites públicos e análise do enquadramento telecom/SVA. O art.61 da LGT existe, mas o modelo não é automaticamente classificado apenas pelo nome da cobrança. [LGT](https://www.planalto.gov.br/ccivil_03/leis/l9472.htm).
