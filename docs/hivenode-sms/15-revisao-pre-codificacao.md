# Revisão do planejamento do HiveNode SMS

18/11/2026 · Registro histórico da revisão. As decisões adotadas foram incorporadas ao [PRD](01-prd.md), [plano de entrega](12-entrega-operacao.md) e [backlog](issues/README.md) da versão 1.1. Esses documentos são a referência operacional atual.

## Parecer

O plano é sólido como destino do produto. Já dá para iniciar a prova de viabilidade no Android, validar a cobrança em sandbox e preparar testes isolados. Ainda há decisões que alteram código suficiente para valer a pena fechá-las antes de implementar todas as rotas, a migração de proxy e os dois apps.

A recomendação é começar com um piloto transacional para empresas que já tenham aparelho e linha elegíveis. Um proprietário, um aparelho Android principal, seleção de SIM, envio individual, diagnóstico e API mínima bastam para provar a proposta. A oferta de longo prazo continua abrangendo os públicos e recursos do PRD. Escolher um primeiro grupo permite descobrir restrições de aparelho, elegibilidade e custo de suporte antes de construir recursos que dependem deles.

## O que vale manter

| Decisão | Por que ajuda |
|---|---|
| Mensalidade por aparelho habilitado, com dois chips contando como uma vaga | Fácil de precificar e explicar. O HiveNode vende gestão, e a operadora cobra a linha do cliente. |
| Mesma conta e painel, com SMS e proxy independentes | Evita dois logins e permite contratar um produto isolado. Também permite suspender SMS sem derrubar proxy. |
| Aparelhos e chips da própria conta | Mostra quem autorizou cada envio, delimita custo e reduz exposição entre clientes. |
| Equipes com permissões por serviço e maior benefício ativo | Uma pessoa conta uma vez. Um operador de SMS pode trabalhar sem acessar senhas de proxy ou faturas. |
| Seleção explícita do SIM e pausa após troca | Preserva o remetente esperado e evita usar a linha errada silenciosamente. |
| Confirmar envio e entrega separadamente | O cliente consegue ler o estado real e decidir o que fazer ao faltar recibo. |
| Registrar a intenção de envio e a tentativa física em separado | Repetir uma requisição, um job ou um callback pode ser seguro sem repetir o SMS. |
| Descadastro, limite por linha e auditoria | A responsabilidade do cliente tem controles concretos no produto. A plataforma consegue agir quando há abuso. |
| Simulador antes da homologação física | Desenvolvedores conseguem testar falhas e concorrência sem gastar SMS. O celular confirma o que só o Android e a operadora podem provar. |

## Financeiro e comercial

### Começar por quem já resolve um problema recorrente

**Proposta de piloto:** poucas empresas brasileiras com lembretes, confirmações e avisos transacionais, aparelho dedicado e linha elegível. Fazer as primeiras ativações de forma assistida e registrar tempo de instalação, taxa de aprovação de linhas, primeiro envio, horas de suporte, conversão e renovação. Campanhas, agências com muitas contas e volumes maiores entram depois de provar o fluxo básico. Cobrar pelo número de aparelhos continua compatível com os demais públicos no futuro.

**Mensagem comercial:** “Gerencie SMS da sua própria linha. A mensalidade cobre o HiveNode. Os limites e as tarifas da linha seguem o contrato da operadora.” Usar exemplos de avisos e confirmações. A frase evita prometer volume, velocidade ou entrega que dependem do aparelho, da rede e do contrato. Manter validação por linha e finalidade. “Ilimitado” pode gerar expectativas falsas mesmo quando o HiveNode não cobra por mensagem. [Exemplos contratuais da Claro](https://www.claro.com.br/files/104379/x/b7ba5cabff/condicoes-gerais-de-contratacao-pf_site.pdf) e [Vivo Empresas](https://vivo.com.br/content/dam/vivo-sites/vivo-com-br/para-empresas/pdf/produtos-e-servicos/servicos-essenciais/movel/Termo_Servico_Movel_Pessoal.pdf).

### Preservar os preços como hipótese e medir suporte por plano

| Plano proposto | Preço mensal | Vagas | Receita bruta por aparelho com todas as vagas usadas |
|---|---:|---:|---:|
| Inicial | R$ 19,90 | 1 | R$ 19,90 |
| Equipe | R$ 49,90 | 5 | R$ 9,98 |
| Operação | R$ 99,90 | 15 | R$ 6,66 |

No Inicial, uma cobrança de R$ 19,90 deixa cerca de R$ 19,10 após Pix de R$ 0,80 ou R$ 18,60 após cartão à tarifa pública inicial de 3,5% + R$ 0,60. Valores antes de impostos, perdas, infraestrutura e suporte, e sujeitos à conta e ao prazo de recebimento. Se a hipótese de custo variável máximo de 30% da receita bruta for mantida, restam R$ 5,17 no Pix ou R$ 4,67 no cartão após a taxa para todos os outros custos variáveis. Cinco minutos de suporte a um custo interno hipotético de R$ 60/h consomem R$ 5. A análise contratual manual por linha pode virar o maior custo. [AbacatePay, taxas e prazos](https://www.abacatepay.com/duvidas/quanto-custa-a-abacatepay).

**Melhoria:** manter os três preços no planejamento, medir custo por conta e por aparelho habilitado antes da oferta pública e usar o Inicial para validar retenção. Registrar separadamente custo de primeiro cadastro, suporte recorrente, impostos, taxa real do gateway, reembolsos, banco, tráfego e observabilidade. Se o Inicial não fechar, simplificar a ativação e o suporte incluído antes de baixar preço. A análise assistida pelo HiveNode pode ser paga opcionalmente quando for consultoria, sem transformar a checagem básica em cobrança surpresa.

### Verificar antes de cobrar

Alterar a ordem proposta na [jornada de ativação](09-painel-jornadas.md): diagnóstico sem pagamento → checar canal de instalação, aparelho e SIM → aprovar linha e obter autorização local → enviar a um destinatário de teste controlado, no piloto → ativar período de teste ou ofertar a assinatura. Para o teste de sete dias já proposto, iniciar os relógios após prontidão confirmada e ação explícita do cliente. Manter modo demonstrativo sem chip aprovado. Isso reduz reclamações, estornos e horas de atendimento por contas que pagaram sem poder usar.

### Usar um ciclo de cobrança simples primeiro

A rota atual cria o checkout antes de gravar a assinatura local (`web/src/app/api/billing/subscribe/route.ts:70–105`). E o handler atual marca cancelamento de imediato e usa `balanceGB` e `activePlanId` (`web/src/lib/payment-events.ts:34–55`). Assim, a integração legada não é base pronta para o SMS.

**Recomendação:** criar uma intenção de compra única por conta e serviço antes de chamar o gateway. A rota atual grava `subRes.data.id` em `abacatePaySubId`, mas a criação retorna `bill_` e a assinatura `subs_` nasce após o pagamento. Guardar referência local, ID do checkout e ID da assinatura como identificadores distintos. Reconciliar timeouts, webhook que chega cedo, evento fora de ordem e duplicidade. O mesmo checkout pode aparecer em renovações. Use o ID da cobrança/parcela confirmada com valor, moeda e plano esperados para liberar cada período uma vez. Renovação só muda o direito SMS. Guardar separadamente validade já paga, cancelamento da renovação e bloqueio por estorno, disputa ou abuso. [Checkout](https://docs.abacatepay.com/pages/subscriptions/create) e [eventos de assinatura](https://docs.abacatepay.com/pages/webhooks/events/subscriptions).

No piloto, usar um meio mensal confirmado em sandbox e programar upgrade e downgrade para o próximo ciclo quando suportados. A API de troca aplica no ciclo seguinte e documenta rejeição de troca de valor para Pix Automático. A mudança pode precisar de nova autorização e encerramento da renovação antiga. Deixar cálculo proporcional para quando a conta do gateway e o fluxo de reembolso estiverem provados. Confirmar disponibilidade de Pix Automático na loja real. Mostrar a validade já paga, o efeito do cancelamento sobre vagas da equipe compartilhada e como exportar o histórico. O fim da renovação, o estorno e o arrependimento quando aplicáveis têm efeitos diferentes e merecem fluxos próprios. [Troca de plano](https://docs.abacatepay.com/pages/subscriptions/change-plan), [checkout de assinatura](https://docs.abacatepay.com/pages/subscriptions/create), [portal da AbacatePay](https://www.abacatepay.com/area-do-cliente) e [Decreto 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm).

## Estrutura, desenvolvimento e segurança

| Prioridade | O que melhorar | Efeito prático |
|---|---|---|
| Antes da primeira integração | **Definir o cadastro do aparelho SMS.** O OpenAPI já exige credencial no agente, mas ainda não diz como ele a recebe. O cadastro privado atual exige `PRIVATE_FLEET`, e o QR atual aprova um usuário. Especificar pareamento de uso único, com conta, instalação, serviço, autorização do proprietário e confirmação local. A credencial SMS tem ciclo próprio de emissão, rotação e revogação. `web/src/app/api/nodes/route.ts:55–67` e `web/src/app/api/auth/device-code/approve/route.ts:25–31`. | Uma conta que contratou só SMS consegue conectar seu celular. Um QR antigo ou compartilhado não vincula o aparelho à conta errada. |
| Antes do piloto | **Começar com conta própria e autorização aditiva.** Aparelho e objetos SMS já nascem com conta, ownership e permissões. No começo, expor apenas o proprietário e preservar as rotas legadas de proxy, os shares, os créditos e as regras da beta Miner. Habilitar equipe multiusuário e migrar autorização/cobrança proxy em entregas separadas, com comparação de resultado e ensaio de rollback. | Um ajuste no cadastro ou cobrança de SMS tem um raio menor de falha. A mesma identidade serve aos dois produtos e a arquitetura continua pronta para equipes. |
| Antes de liberar convites | **Fechar prova de email e automação de equipe.** O cadastro atual não tem status de email verificado. Pode-se provar posse restringindo a aceitação ao link de uso único entregue à caixa correspondente e à pessoa autenticada. Em integrações duráveis, considerar credencial de serviço controlada pelo proprietário depois do piloto. Chaves pessoais continuam revogáveis ao remover o membro. `web/src/app/api/auth/register/route.ts:39–61`. | Convite não entrega acesso a quem digitou um email alheio. Uma futura automação da empresa terá proprietário definido e a saída de um funcionário será previsível. |
| Antes de executar em aparelho | **Separar cadastro da linha de aprovação.** Cliente registra evidência e acompanha pendência. A linha fica apta após decisão confiável, com versão, finalidade, limite, expiração e responsável. Uma rota de edição de política não deve se confundir com a aprovação. Definir também como trocar/revogar SIM, pausar localmente e receber callbacks pendentes sem emitir novos envios. | Uma linha sem contrato aplicável não nasce elegível por engano. O suporte sabe qual regra levou ao bloqueio. |
| Antes de dimensionar a infraestrutura | **Usar PostgreSQL como autoridade e escolher uma fila principal para o piloto.** Um worker pode consumir tarefas duráveis no banco com transações curtas e índices por estado e próxima execução. Redis pode permanecer onde o projeto já usa ou precisa dele, como rate limit/replay. Adotar BullMQ para o SMS desde o início se houver ganho operacional demonstrável, com outbox e reconciliação. | Evita dois mecanismos disputando as mesmas mensagens. Mantém uma resposta clara para “já foi autorizada?”. [PostgreSQL, `FOR UPDATE` e `SKIP LOCKED`](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE). |
| Antes de congelar a API | **Publicar contrato pequeno e testado primeiro.** Fixar cadastro, inventário, um envio, consulta, pausa e operações nativas. Incluir exemplos com a mesma requisição em TypeScript e Kotlin, testes de erro, versão de protocolo e estados suportados. MCP local reutiliza a mesma autorização da REST após estabilizar o caminho. | Os devs implementam um fluxo completo em vez de manter 52 operações incompletas em paralelo. |

Índices e chaves compostas verificam a combinação exata conta, aparelho e SIM. A regra “um proprietário” exige impedir tanto dois proprietários quanto a saída do último. Nas operações concorrentes, confirmar em transação apenas a reserva ou a alteração de estado e fazer chamadas ao gateway fora da transação. Um teste deve derrubar a chamada entre esses passos e demonstrar como a reconciliação conclui a intenção sem cobrar duas vezes. [PostgreSQL, restrições de integridade](https://www.postgresql.org/docs/current/ddl-constraints.html).

O OpenAPI hoje oferece chave de API ou sessão para operações como aceite de termo, transferência de conta e cobrança. A matriz de autenticação precisa restringir esses atos a pessoas autorizadas e exigir confirmação recente onde apropriado. Ao liberar equipes no proxy, decidir como revogar painéis já conectados, novos túneis e acesso por credencial SOCKS já entregue. Revogar um membro do painel não revoga automaticamente uma credencial que ele conhece. Testar remoção enquanto a conexão permanece aberta. `broker/internal/tunnel/websocket.go:461–510` e `broker/internal/tunnel/socks5.go:91`.

## Aparelho e funcionamento

### Provar o canal de instalação primeiro

Começar pelo Android principal com o APK assinado e o canal que o cliente realmente usará. Testar instalação, permissão do instalador e do sistema, escolha de SIM e um destino controlado. `SEND_SMS` é permissão restrita. Uma autorização na tela pode ser insuficiente quando o instalador não permite a concessão. Na Play Store, confirmar enquadramento e declaração. Para distribuição fora da loja, confirmar a verificação do desenvolvedor e os requisitos do canal usado no Brasil. [Permissão SEND_SMS](https://developer.android.com/reference/android/Manifest.permission#SEND_SMS), [Google Play](https://support.google.com/googleplay/android-developer/answer/10208820) e [verificação de desenvolvedor Android](https://developer.android.com/developer-verification).

Separar o gate do Light do Android principal. O Light atual declara `targetSdkVersion 22` (`hivenode-light/android-app/app/build.gradle:10`). A instalação nova no Android 15 exige target 24 ou superior. Isso difere do Android instalado no aparelho e do mínimo API 26 proposto para o recurso SMS. O [HNS-32](issues/HNS-32.md) hoje depende do Light, enquanto o [checklist de release](12-entrega-operacao.md) aceita manter a flag Light desligada. Dividir os dois aceites remove a contradição e permite testar o principal cedo. [Regra de instalação no Android 15](https://developer.android.com/about/versions/15/behavior-changes-all#minimum-target-api-level).

### Assumir operação assistida no piloto

Mostrar no app a sessão de envio iniciada pela pessoa, com conta, aparelho, SIM e botão de pausa. O painel mostra último contato, disponibilidade, validade e instrução para retomar. Antes de anunciar operação remota com a tela apagada ou agendamento firme, medir em aparelhos reais com modo de economia, tela desligada, reboot, force-stop e proxy simultâneo. O plugin Notifee do app já configura `dataSync`. Para apps com target Android 15+, esse tipo tem limite em segundo plano. WorkManager pode servir para conciliar estado, com agendamento sujeito ao sistema. [Timeout de foreground services](https://developer.android.com/develop/background-work/services/fgs/timeout) e [WorkManager](https://developer.android.com/reference/androidx/work/PeriodicWorkRequest).

Para escolher os aparelhos do piloto, usar o hardware disponível e registrar modelo, versão do Android, versão do app, operadora e linha elegível. Testar dual SIM/eSIM quando o hardware permitir. Se a linha trocar mantendo o slot ou o sistema ocultar o número, mostrar o vínculo que falta confirmar e pedir nova validação. Registrar bateria, aquecimento, requisições do agente e atraso até o modem. Medir separadamente atraso de fila e resposta da operadora. Mostrar disponibilidade de proxy e SMS separadamente.

Explicar o que aparece no celular. Pelas APIs padrão, o Android pode registrar o SMS enviado no histórico do aparelho, e eventuais respostas chegam à linha. A política de retenção do HiveNode só abrange as cópias que ele controla. Recomendar aparelho dedicado, excluir credenciais e fila nativa do backup e da transferência do app e testar reinstalação e troca do aparelho. A nova instalação precisa de vínculo próprio. [Histórico no SmsManager](https://developer.android.com/reference/android/telephony/SmsManager#sendTextMessage(java.lang.String,java.lang.String,java.lang.String,android.app.PendingIntent,android.app.PendingIntent)) e [backup no Android](https://developer.android.com/identity/data/autobackup).

### Fechar a fronteira entre autorização e modem

| Situação | Regra recomendada para o piloto |
|---|---|
| Job retirado e destinatário bloqueado antes da autorização | `LEASED → SUPPRESSED`. O protocolo exige revalidação e hoje só lista supressão a partir de `QUEUED`. Cobrir a corrida entre retirada e autorização. |
| Aparelho reiniciou ou perdeu conectividade depois da autorização | Exigir autorização válida vinculada à instalação, SIM e versão da política. No piloto, pedir conexão no momento da instrução ao modem. Registrar `INVOKING` no banco local antes da chamada. Autorização vencida nunca inicia envio. |
| Houve início e o resultado ficou incerto | Marcar `UNKNOWN`, sem retry automático da mesma mensagem. Quando o prazo de reconciliação acabar, liberar o aparelho para outros envios elegíveis com a trava da mensagem anterior preservada. |
| Só parte dos segmentos foi confirmada | Mostrar `PARTIAL`, com resultado por segmento. Reenvio deliberado recebe outro ID e exige texto, propósito e política novamente válidos. |
| Falha conhecida | Pilotar retry automático apenas com causas comprovadas antes de chamar o modem. Ampliar a lista quando houver evidência para a combinação Android/aparelho/operadora. Resultado genérico do Android não prova que nenhum segmento saiu. |
| SMS aceito para envio, sem recibo de entrega | Liberar a capacidade do aparelho quando o resultado de envio for conciliado. O estado de entrega pode chegar depois e o painel atualiza sem nova execução. |
| Cliente pausou enquanto havia autorização válida | Pausa bloqueia autorizações futuras. Uma chamada já iniciada pode continuar. Mostrar essa janela em linguagem simples. |

O [protocolo](07-fila-protocolo.md) precisa de regras objetivas para precedência de eventos, sequência fora de ordem, motivo de pré-checagem, prova de nenhuma invocação, relógio, perda de resposta, duração da trava do aparelho e aceite de eventos atrasados após revogação. Associar exemplos ao contrato legível por máquina. Sem isso, dois devs podem tratar o mesmo erro do Android de maneiras diferentes. [SmsManager, códigos e callbacks de envio e entrega](https://developer.android.com/reference/android/telephony/SmsManager).

- A tentativa guarda só o hash do token de retirada, mas o contrato promete retornar o mesmo token ao repetir a chamada. Escolher token assinado reproduzível ou cópia cifrada até a expiração. Com o banco indisponível, devolver erro temporário e manter eventos na fila local. Confirmar o recebimento só depois de gravar. Duplicata exata, conflito de conteúdo e erro temporário precisam de respostas distintas.
- Calcular idempotência com base no pedido original. Se o servidor gerar um link de descadastro ou preencher a data, reutilizar os valores da primeira criação. Revalidar a permissão atual antes de devolver o resultado de uma chave repetida. Incluir no contrato o cabeçalho de replay já previsto no texto.
- Para “entregue”, tipar a evidência de entrega e interpretar o relatório da rede. Um callback sem status reconhecível fica sem confirmação. O campo genérico `platformCode` sozinho não documenta a diferença entre falha de envio e relatório de entrega. [Relatório de status do Android](https://developer.android.com/reference/android/telephony/SmsMessage#getStatus()).

## Manuseio, facilidade e atendimento

- Fazer a primeira tela responder três perguntas: qual aparelho, qual chip e por que posso ou não enviar agora. Mostrar bloqueios acionáveis, como “abra o app no aparelho”, “autorize este chip” ou “linha em validação”. Separar falha da rede, indisponibilidade do aparelho e política da conta.
- Dar um envio de teste guiado e começar com destinos controlados. No painel, deixar sempre visíveis remetente, destino mascarado, estimativa de segmentos e validade. A contagem oficial do app aparece após a verificação nativa. O cliente precisa entender que uma mensagem longa pode gerar vários segmentos à operadora.
- Trocar “agendado para 10h” por “a partir das 10h”, com janela de validade e explicação de que o celular precisa estar disponível. Permitir pausar sem apagar a fila. Em retomada, pedir revisão de mensagens vencidas ou que perderam relevância.
- Mostrar “envio confirmado” e “entrega não confirmada” como estados distintos. Oferecer nova mensagem com confirmação extra quando o resultado anterior ficou desconhecido ou parcial. Evidências disponíveis devem ser claras para atendimento e cliente sem expor telefone completo ou texto em logs.
- Resolver a incoerência entre lote, prazo e capacidade antes de oferecer importação em massa. No cenário hipotético de um segmento por minuto, 10 mil segmentos levam quase sete dias. A validade padrão prevista é de 24 horas. Estimar pressão da fila, avisar sobre risco de expiração e escolher limites apoiados na política real da linha. A configuração do HiveNode não representa autorização de uma operadora.
- Conservar descadastro e denúncias como decisões de produto. Quando marketing for habilitado, fechar evidência de finalidade/base, escopo do bloqueio, validade do link e proteção contra exposição de destinatário. Uma escolha “transacional” no formulário não legitima conteúdo de marketing. Para o piloto transacional, restringir finalidade e usos autorizados desde o começo. [ANPD, guia sobre legítimo interesse](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_de_dados_pessoais_legitimo_interesse).

## Testes e liberação

O plano já tem 54 casos. A melhoria é antecipar os que derrubam premissas do produto e separar objetivos que a suíte de documentação não consegue provar.

| Marco | Evidência mínima |
|---|---|
| Viabilidade | Instalar pelo canal escolhido, conceder permissão, selecionar o SIM, enviar para destino controlado e registrar estados disponíveis. Confirmar ao menos uma linha elegível e a forma de operar o app. |
| Fluxo simulado completo | Conta SMS-only pareia, cria um envio, acompanha, cancela pendente e pausa. Duas contas isoladas. Chave revogada falha. Repetir a mesma solicitação devolve a mesma mensagem. Nenhum caminho simulado aciona modem. |
| Concorrência e falhas | Duas requisições ou dois workers não duplicam autorização. Testar crash antes/depois da chamada nativa, evento duplicado ou atrasado, expiração, troca de SIM, resultado parcial, restauração sem reenvio de fila e replay de cobrança. |
| Capacidade | Separar teste de API e execução do aparelho. O PRD pede 10 req/s por conta, que excedem as 60 escritas/min/conta da regra comercial e 10 escritas/min/chave. Distribuir carga entre contas/chaves dentro da cota ou usar perfil de estresse declarado. Testar 429 separadamente. Medir também custo de consultas ociosas do agente e diferença entre solicitações unitárias e lotes. |
| Piloto real | Android principal no canal aprovado, linhas aptas, destinatários controlados, checkout homologado quando houver cobrança. Medir tempo até primeiro envio, estados desconhecidos, consumo do app e custo por implantação. Qualquer duplicação física registrada ou vazamento entre contas interrompe a expansão até correção. |
| Expansão | Validar com testes próprios Light, segundo plano mais amplo, equipes nos dois serviços, marketing, lotes grandes e webhooks. Separar a aprovação de cada área para o usuário conhecer o que está disponível. |

Os critérios de sucesso comercial devem ganhar alvo e dono antes do piloto, pois “medir” sozinho não determina quando expandir. Começar com quatro leituras simples: quantas linhas elegíveis chegam ao primeiro envio, quanto tempo isso toma, quantos clientes voltam a usar ou pagam e quanto custa prestar suporte. No próprio piloto, estabelecer a referência técnica de atraso e resultado desconhecido por modelo e operadora antes de publicar uma expectativa.

## Decisões propostas para congelar

| Decisão | Proposta para começar | Onde refletir |
|---|---|---|
| Quem testa primeiro | Empresas com caso transacional, linha elegível e aparelho dedicado. | PRD e HNS-01/33 |
| Distribuição e funcionamento | APK principal no canal escolhido, sessão visível e prova de permissão no celular real. Light com gate independente. | HNS-02/24/25/32 |
| Primeira entrega | Proprietário, conta própria, um aparelho, SIM explícito, envio individual, resultado e diagnóstico. REST mínima. | PRD, HNS-03/13/15/17/18/23/26 |
| Financeiro | Manter R$ 19,90 / 49,90 / 99,90 como hipótese. Verificação antes do teste ou da cobrança. Um meio mensal validado, plano muda no próximo ciclo. | Cobrança e HNS-11/12/33 |
| Integração com proxy | Dados SMS na conta desde o início, com adesão gradual das rotas proxy e sem alterar o pacote legado durante o piloto. | Dados, autorização e HNS-04–09 |
| Política de linha | Aprovação separada do cadastro, SIM explícito, limite da política e pausa quando permissão ou vínculo mudarem. | HNS-13/17/23 |
| Recuperação | Sem retry automático após invocação no piloto. Conciliação primeiro, nova mensagem manual auditada quando for o caso. | Protocolo, OpenAPI, máquina de estados e HNS-17/18/23 |
| Expansão | Equipe e REST completa, agenda/lotes, webhooks, MCP local, Light e marketing entram por valor e validação. MCP remoto mantém gate próprio. | PRD, entrega e dependências das issues |

A sequência recomendada é **prova no Android e no sandbox de pagamento em paralelo → fluxo vertical com simulador → piloto Android principal → cobrança validada → capacidades adicionais**. Pode-se começar pelas investigações e pela estrutura de testes. As decisões da tabela orientam o primeiro código de produto e precisam ser espelhadas no PRD, nos contratos e no backlog antes de o time dividir a implementação.

Revisão baseada na documentação e na leitura do código local. Os validadores da documentação e dos schemas passaram. A referência à homologação “daqui a alguns dias” é de outubro. Atualizar o marco com build, responsável e evidência quando o teste ocorrer. A viabilidade de envio físico, a margem e o comportamento da conta de pagamentos ainda precisam de evidência dos respectivos testes.
