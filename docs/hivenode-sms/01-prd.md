# PRD — HiveNode SMS e equipes compartilhadas

## Problema e resultado

O cliente precisa usar seus próprios aparelhos Android e linhas para enviar SMS pelo painel, API e MCP. Quer escolher o chip, acompanhar resultados e tratar falhas sem operar cada celular manualmente. A mesma conta deve entregar proxy e SMS, com equipes e permissões independentes por serviço.

O HiveNode vende gestão e infraestrutura de software. O cliente contrata e paga sua linha diretamente à operadora. SMS não participa da frota pública nem do compartilhamento de nós entre clientes. Membros da mesma conta não são clientes externos.

Públicos: pessoas físicas, pequenas empresas, desenvolvedores, agências e empresas. Agências acessam contas separadas dos seus clientes por convite; nunca usam um pool de chips compartilhado entre essas contas. Suporte dedicado e necessidades fora dos limites publicados exigem orçamento.

## Escopo do lançamento

- Equipes, convites, papéis e autorização por serviço/recurso em toda a plataforma.
- Migração compatível das contas individuais e do proxy atual.
- Assinatura SMS independente, mesmos login/painel/apps, regras comuns de membros.
- Android principal e HiveNode Light em aparelhos compatíveis; Light antigo permanece proxy-only.
- Detecção de linhas ativas, escolha explícita, vinculação e autorização por linha.
- Mensagem individual, lote, modelos, agenda, resultado, cancelamento pendente, exportação e webhooks.
- API REST versionada e MCP local autenticado. MCP remoto interoperável terá gate próprio de OAuth.
- Retentativas apenas quando houver falha segura, reconciliação e resultado desconhecido.
- Descadastro, responsabilidade, restrições contratuais, auditoria e retenção.
- Simulador sem modem e roteiro de homologação física posterior.

Não inclui: gateway automático iOS, leitura geral da caixa de entrada, resposta `SAIR` por recepção nativa no primeiro lançamento, MMS/RCS/WhatsApp, números alugados, spoofing de remetente, saldo exato universal da operadora, vendas de créditos SMS, troca automática de chip/remetente, garantias de leitura ou entrega, LLM decidindo retentativas, planos anuais, frota pública de SMS, 2FA novo ou mudança comercial dos planos proxy existentes. Recebimento nativo será extensão separada; o lançamento usa link seguro de descadastro.

## Requisitos funcionais rastreáveis

| ID | Requisito | Aceite objetivo |
|---|---|---|
| R01 | Conta empresarial e migração | Cada usuário cliente existente recebe uma conta com proprietário; recursos atuais continuam utilizáveis |
| R02 | Equipe única para SMS/proxy | Capacidade é o maior benefício elegível, mínimo 1, nunca a soma; convites concorrentes não excedem vagas |
| R03 | Permissões por serviço/aparelho | Membro somente SMS não acessa proxy; objeto de outra conta resulta 404 sem dados |
| R04 | Assinatura SMS independente | Cancelar SMS não corta proxy ativo; pagamento duplicado não concede período duplicado |
| R05 | Detecção de chips | App informa apenas linhas ativas acessíveis; remoção/troca invalida vínculo e pausa a fila |
| R06 | Habilitação explícita | Sem aceite vigente, linha elegível e autorização local, nenhum envio chega ao modem |
| R07 | Envio simples e idempotente | Repetir chave/corpo retorna mesma mensagem; mesma chave/corpo diferente resulta 409 |
| R08 | Lote e agenda | Cada destinatário tem ID/estado próprio; agenda conserva instante UTC e fuso de apresentação |
| R09 | Estados verdadeiros | Enviado, entregue, parcialmente enviado e desconhecido são distintos; ausência de recibo não vira falha |
| R10 | Recuperação segura | Queda após início não reenvia sozinha; retry exige evidência de nenhum segmento aceito |
| R11 | Diagnóstico | Exibe código bruto seguro, categoria, certeza e próxima ação; hipótese não é fato |
| R12 | Painel acessível | Usuário acompanha, filtra, cancela pendentes, pausa e exporta somente dados autorizados |
| R13 | API e credenciais | Chaves têm conta fixa, escopos, recursos, criador, revogação e segredo exibido uma única vez |
| R14 | MCP equivalente | Ferramentas usam o mesmo serviço de aplicação/validação da API, sem acesso direto ao banco |
| R15 | Webhooks confiáveis | Evento com ID, assinatura, retentativas limitadas e proteção SSRF; duplicação documentada |
| R16 | Privacidade e descadastro | Conteúdo expira; supressão bloqueia destinatário inclusive se retirada da fila pelo aparelho |
| R17 | Auditoria e responsabilidade | Origem de comando, ator/credencial, conta, recurso, política e versão do aceite são rastreáveis |
| R18 | Compatibilidade e segundo plano | Aparelho sem capacidade recusa SMS; pausa do SO é exibida e não se promete execução contínua |
| R19 | Operação e desligamento | Kill switch impede novas autorizações; eventos finais ainda são reconciliados |
| R20 | Testes reproduzíveis | Gates sem modem e físicos separados, com evidências e nenhum status de teste inventado |
| R21 | Métricas comerciais | Receita/custos, aparelho habilitado, atraso, duplicações reportadas e suporte são mensuráveis sem conteúdo |
| R22 | Preservação de proxy | BYOD, frota pública, shares legados, saldo e cobrança de bytes passam regressão |

## Requisitos não funcionais

Segurança: negar acesso por padrão, isolamento por conta em todas as consultas, eventos internos autenticados, TLS em produção, segredos cifrados/hasheados, ações críticas revalidadas antes de execução.

Consistência: banco é fonte de verdade; filas podem perder/repetir notificações sem perder mensagens persistidas. Não prometer exatamente um envio físico em todas as falhas.

Metas iniciais de engenharia, não SLA comercial: em staging com simulador, 10 requisições/s por conta durante 10 minutos, p95 de aceite <1 s, sem vazamento entre contas e sem criação duplicada para chaves repetidas. Medir ambiente, número de destinatários e tamanho do payload. Velocidade de modem não é essa meta.

Disponibilidade: SMS não depende de assinatura proxy; pode manter controle sem túnel proxy. Se banco, autorização ou conformidade não puderem ser verificados, bloquear novas autorizações de envio.

UX: português brasileiro, teclado e leitores de tela, erros com ação, números mascarados por padrão, confirmação de lote/ação irreversível e ausência de diagnósticos inventados.

## Jornadas principais

1. Proprietário cria conta/aceita termos, contrata/testa, habilita aparelho, seleciona linha, fornece condições contratuais e autoriza localmente.
2. Operador autorizado envia para número próprio de teste; recebe ID e acompanha as evidências de envio e entrega.
3. Desenvolvedor cria chave restrita, solicita envio e consulta resultado/webhook; uma segunda chamada idêntica não duplica.
4. Administrador convida membro somente SMS; esse membro não visualiza credenciais proxy nem cobrança.
5. Aparelho fica offline; fila aguarda dentro da validade. Após envio iniciado e desconexão, conciliação substitui retry cego.
6. Cliente cancela SMS: mantém período pago, depois novos envios param; proxy permanece conforme sua própria assinatura.

## Definition of Done do produto

- R01–R22 possuem evidências de aceite ou dependência de gate físico explicitamente pendente.
- Migração e rollback ensaiados com dados representativos e backup restaurado.
- Web/API/MCP/worker/simulador/broker/proxy passam a matriz automatizada.
- APKs assinados identificados por hash; homologação física do proprietário registra build, Android, modelo e linha.
- Comercial, jurídico, canal de distribuição e pagamentos reais liberados pelos responsáveis.
- Nenhum SMS real é habilitado em produção antes dos gates físico e de linha.

## Sucesso do negócio

Medir ativação (primeiro teste autorizado), contas pagantes, churn, margem de contribuição, minutos de suporte por conta, erros por categoria, resultados desconhecidos e falhas de execução reportadas. Não usar volume de disparos como incentivo para contornar operadoras. Revisar preços após piloto, sem reajustar silenciosamente contratos existentes.
