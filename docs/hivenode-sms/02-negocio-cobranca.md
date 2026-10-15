# Especificação comercial e de cobrança

## Catálogo inicial

Valores em reais, mensalidade antecipada; armazenar preços em centavos inteiros. Baseline aceito para planejamento; validação econômica é gate de lançamento.

| Slug proposto | Nome | Centavos/mês | Aparelhos SMS | Benefício global de membros | Eventos visíveis por dias |
|---|---|---:|---:|---:|---:|
| sms-inicial | SMS Inicial | 1990 | 1 | 1 | 30 |
| sms-equipe | SMS Equipe | 4990 | 5 | 3 | 90 |
| sms-operacao | SMS Operação | 9990 | 15 | 10 | 180 |

Acima de 15 aparelhos: orçamento privado, com valores e limites explícitos. Nenhum adicional avulso, plano anual, setup obrigatório ou cobrança por mensagem no lançamento. Suporte assíncrono em português em horário comercial, sem compromisso de resposta 24/7. Sessão assistida opcional: baseline de R$ 99,90 por até uma hora, cobrada separadamente somente após contratação expressa.

Todos os planos incluem painel/API/MCP local, chips ativos, modelos, agenda, lote, estados, exportação, webhooks e controles básicos. Recursos não ficam bloqueados artificialmente para desenvolvedores do plano Inicial. MCP remoto OAuth é liberação condicionada à sua issue.

## Regras de capacidade

`memberCapacity = max(1, eligibleSubscriptions.memberBenefit, eligibleTrial.memberBenefit)`.

Assinatura elegível: período pago em vigor, inclusive cancelamento agendado; bloqueio administrativo fundamentado pode revogar direito. Planos proxy antigos contribuem 1 até receberem benefício explícito no catálogo: não inventar 5/10 membros para planos atuais. Não somar benefícios SMS+proxy e não cobrar pessoa duas vezes por acessar ambos.

Conta A com SMS Equipe (3 membros) e proxy futuro com benefício 10 tem 10 vagas globais. SMS continua com 5 aparelhos, mesmo que 10 membros possam receber permissão SMS. Conta A sem plano pago preserva proprietário para cobrança/exportação autorizada, sem execução SMS.

Vagas de membro: proprietário + membros ACTIVE + convites PENDING não expirados. Convite reserva vaga por 72 horas. Suspensos, removidos e convites expirados não contam. Contagem e criação devem ocorrer sob lock da conta/transação serializável; UI não é proteção suficiente.

Vagas de aparelho SMS: `DeviceService(service=SMS, enabled=true)` consome uma vaga mesmo offline. Dois chips no mesmo aparelho não consomem duas vagas. Instalação simultânea/clonada não é autorizada; substituir exige desabilitar a instalação anterior e conciliar mensagens iniciadas.

Um mesmo aparelho pode consumir uma vaga SMS e uma vaga proxy. Compra SMS não concede GB, créditos, HivePoints, proxies nem acesso à frota pública. Nenhuma conta pode usar SMS por `NodeShare`, visibilidade pública ou privilégios implícitos do administrador da plataforma.

## Teste

7 dias corridos a partir da ativação explícita, um aparelho, um membro, 100 segmentos físicos autorizados, uma vez por conta e proprietário inicial. Não enviar sem requisitos da linha. O teste não renova automaticamente para pago sem contratação. Conta verificada e controle de abuso reduzem múltiplos testes; não coletar documentos extras sem justificativa.

Reserva de segmentos: preview do aparelho calcula quantidade; antes de autorizar modem, reservar atomicamente o total. Reservas têm ID único da tentativa. Se nenhum segmento foi aceito e a falha é comprovada, liberar; se resultado incerto, manter reservado. Conversão reserva→consumido é idempotente; reenvio deliberado é outra reserva. Não usar número de caracteres JavaScript como faturamento. Planos pagos mantêm contador informativo, sem débito por SMS.

## Assinaturas e pagamentos

Uma assinatura corrente por conta/categoria de serviço. Categoria nova `SMS`, sem reutilizar `PRIVATE_FLEET`. Histórico pode conter assinaturas antigas, canceladas ou trocas pendentes. Eventos do gateway são a confirmação financeira; URL de retorno não libera acesso.

Campos necessários: serviço, preço/limites snapshot, início/fim UTC, ciclo mensal, `cancelAtPeriodEnd`, ID de cobrança externa único, revisão de entitlement e troca agendada. O snapshot evita aplicar alteração de preço do catálogo a um período já contratado.

Pagamento recebido duas vezes estende o período uma vez. Eventos fora de ordem são reconciliados com estado/identidade de cobrança do gateway. Reembolso/chargeback têm fluxo próprio e não subtraem GB de SMS. Metadados não autorizam cliente a escolher outra conta. Registrar recibo e trilha de reconciliação.

Cartão recorrente e Pix dependem da API/contrato efetivo do gateway. A issue de investigação entrega matriz de suporte a recorrência, cancelamento, atualização, proporcionalidade e sandbox. Se proporcionalidade não existir, implementar cobrança complementar confirmada antes do upgrade; nunca fingir sucesso. Pix manual mostra vencimento e requer confirmação de pagamento.

## Transições comerciais

| Evento | Regra |
|---|---|
| Compra | PENDING até confirmação válida; ACTIVE com período pago |
| Upgrade | Mostrar cotação; cobrar delta proporcional uma vez; novo limite após pagamento confirmado |
| Downgrade | Próxima renovação; cliente escolhe membros/aparelhos que permanecem |
| Cancelar renovação | Registrar intenção; direitos continuam até `currentPeriodEnd` |
| Período termina sem pagamento | Novas execuções SMS param; saldo/assinatura proxy elegível permanece |
| Reactivar | Não retomar mensagens vencidas ou suspensas sem revisão explícita |
| Suspensão por abuso | Parar novas autorizações; manter acesso permitido a cobrança, denúncia e exportação |

Proporcionalidade proposta: `ceil(max(0, novoPreco-antigoPreco) * segundosRestantes / segundosDoPeriodo)`, em centavos, cotação vinculada ao intervalo real UTC, válida por 15 minutos. Exibir preço da renovação. Não usar mês fixo de 30 dias. Se gateway usar cálculo diferente, uma única regra documentada deve prevalecer após a investigação e teste.

Ao reduzir capacidade sem seleção prévia: nunca remover dados nem proprietário. Suspender primeiro membros não proprietários mais recentes e aparelhos SMS habilitados mais recentemente até caber; emitir aviso e permitir seleção posterior. Remover acesso suspende também suas chaves, sem perder rastreabilidade. Convites excedentes são cancelados. Reativação de membros/aparelhos depende de seleção, não ocorre em massa automaticamente.

## Limites públicos de engenharia

Defaults de piloto, configuráveis por ambiente/conta e revisáveis antes de comercializar: 10 solicitações de escrita/minuto por chave, 60/minuto por conta, 100 destinatários/lote, 10.000 mensagens pendentes/conta, 8 segmentos/mensagem e 1 MiB de corpo por requisição. Retornar 429/erro específico e informar limite/ação. Leitura: 120/minuto por chave e 600/minuto por conta. Não cobrar excedente. Contas personalizadas têm limites contratados; nunca alterar silenciosamente.

Esses números protegem o software, não autorizam a linha a enviar nessa velocidade. Política de envio por linha exige condições contratuais explícitas e usa o menor limite aplicável. Sem política autorizada, bloquear execução real. API pode aceitar uma agenda dentro dos limites de fila sem prometer envio imediato.

## Receita e custos

Registrar receita confirmada, taxas efetivas, impostos apurados, infraestrutura atribuída, minutos de suporte e custo de aquisição. Hipótese de piloto: custos variáveis <=30% da receita, a validar; não é margem comprovada. Cem contas Inicial geram R$ 1.990 brutos/mês. Relatório não lê texto de mensagens. Gate comercial deve confirmar que os planos baratos são sustentáveis e que atendimento assistido não é ilimitado.
