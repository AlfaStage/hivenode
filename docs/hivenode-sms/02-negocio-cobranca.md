# Especificação comercial e de cobrança

## Catálogo inicial

Valores em reais, mensalidade antecipada; armazenar preços em centavos inteiros. Baseline aceito para planejamento; validação econômica é gate de lançamento.

| Slug proposto | Nome | Centavos/mês | Aparelhos SMS | Benefício global de membros | Eventos visíveis por dias |
|---|---|---:|---:|---:|---:|
| sms-inicial | SMS Inicial | 1990 | 1 | 1 | 30 |
| sms-equipe | SMS Equipe | 4990 | 5 | 3 | 90 |
| sms-operacao | SMS Operação | 9990 | 15 | 10 | 180 |

Acima de 15 aparelhos: orçamento privado, com valores e limites explícitos. Nenhum adicional avulso, plano anual, setup obrigatório ou cobrança por mensagem no lançamento. Suporte assíncrono em português em horário comercial, sem compromisso de resposta 24/7. Sessão assistida opcional: baseline de R$ 99,90 por até uma hora, cobrada separadamente somente após contratação expressa.

O piloto pago oferta apenas o Inicial com painel, REST individual, diagnóstico e histórico disponível. Catálogo de expansão inclui as faixas Equipe e Operação. Recursos entram conforme as etapas do [PRD](01-prd.md), sem cobrança por mensagem. MCP local entra após REST estável e MCP remoto tem validação própria. A oferta mostra os recursos já disponíveis.

## Regras de capacidade

`memberCapacity = max(1, eligibleSubscriptions.memberBenefit, eligibleTrial.memberBenefit)`.

Assinatura elegível: período pago em vigor, inclusive cancelamento agendado; bloqueio administrativo fundamentado pode revogar direito. Planos proxy antigos contribuem 1 até receberem benefício explícito no catálogo: não inventar 5/10 membros para planos atuais. Não somar benefícios SMS+proxy e não cobrar pessoa duas vezes por acessar ambos.

Conta A com SMS Equipe (3 membros) e proxy futuro com benefício 10 tem 10 vagas globais. SMS continua com 5 aparelhos, mesmo que 10 membros possam receber permissão SMS. Conta A sem plano pago preserva proprietário para cobrança/exportação autorizada, sem execução SMS.

Vagas de membro: proprietário + membros ACTIVE + convites PENDING não expirados. Convite reserva vaga por 72 horas. Suspensos, removidos e convites expirados não contam. Contagem e criação devem ocorrer sob lock da conta/transação serializável; UI não é proteção suficiente.

Vagas de aparelho SMS: `DeviceService(service=SMS, enabled=true)` consome uma vaga mesmo offline. Dois chips no mesmo aparelho não consomem duas vagas. Instalação simultânea/clonada não é autorizada; substituir exige desabilitar a instalação anterior e conciliar mensagens iniciadas.

Um mesmo aparelho pode consumir uma vaga SMS e uma vaga proxy. Compra SMS não concede GB, créditos, HivePoints, proxies nem acesso à frota pública. Nenhuma conta pode usar SMS por `NodeShare`, visibilidade pública ou privilégios implícitos do administrador da plataforma.

## Teste

Diagnóstico gratuito precede teste e pagamento. Após prontidão, política aprovada e autorização local, admitir um único teste de prontidão por conta e instalação para destino controlado. Registrar uso para impedir repetição e explicitar custo da operadora antes de confirmar. Ao ativar o teste por ação do proprietário, iniciar sete dias corridos, um aparelho, um membro e até 100 segmentos físicos autorizados, uma vez por conta e proprietário inicial. Encerrar sem conversão automática. O piloto assistido também pode usar um direito temporário auditado com destino controlado.

Reserva de segmentos: preview do aparelho calcula quantidade; antes de autorizar modem, reservar atomicamente o total. Reservas têm ID único da tentativa. Se nenhum segmento foi aceito e a falha é comprovada, liberar; se resultado incerto, manter reservado. Conversão reserva→consumido é idempotente; reenvio deliberado é outra reserva. Não usar número de caracteres JavaScript como faturamento. Planos pagos mantêm contador informativo, sem débito por SMS.

## Assinaturas e pagamentos

Uma assinatura corrente por conta/categoria de serviço. Categoria nova `SMS`, sem reutilizar `PRIVATE_FLEET`. Histórico pode conter assinaturas antigas, canceladas ou trocas pendentes. Eventos do gateway são a confirmação financeira; URL de retorno não libera acesso.

Campos necessários: serviço, preço/limites snapshot, início/fim UTC, ciclo mensal, `cancelAtPeriodEnd`, ID de cobrança externa único, revisão de entitlement e troca agendada. O snapshot evita aplicar alteração de preço do catálogo a um período já contratado.

Pagamento recebido duas vezes estende o período uma vez. Eventos fora de ordem são reconciliados com estado/identidade de cobrança do gateway. Reembolso/chargeback têm fluxo próprio e não subtraem GB de SMS. Metadados não autorizam cliente a escolher outra conta. Registrar recibo e trilha de reconciliação.

Persistir intenção única por conta e serviço antes da chamada externa. Guardar `externalId`, `bill_` (checkout), `subs_` (assinatura após pagamento) e `payment.id` (parcela) separadamente. Validar assinatura do evento, origem, ambiente, valor, moeda e snapshot do plano. Conceder período uma vez por parcela confirmada. O mesmo checkout pode aparecer em renovações e eventos diferentes podem descrever a mesma parcela. Se a resposta do gateway se perder, reconciliar pela referência persistida antes de permitir nova tentativa. Associar webhook antecipado a uma inbox durável. [Checkout](https://docs.abacatepay.com/pages/subscriptions/create) e [eventos](https://docs.abacatepay.com/pages/webhooks/events/subscriptions).

O piloto usa um único meio mensal confirmado em sandbox e disponível na conta. Preferir cartão recorrente se a conta e o público permitirem. Pix Automático depende da loja e troca de valor pode exigir novo mandato. Encerrar a renovação antiga antes que duas autorizações possam cobrar o mesmo período. Oferecer Pix manual apenas como período avulso validado, com vencimento explícito. [Troca de plano](https://docs.abacatepay.com/pages/subscriptions/change-plan).

## Transições comerciais

| Evento | Regra |
|---|---|
| Compra | PENDING até confirmação válida; ACTIVE com período pago |
| Upgrade | Mostrar novo preço e data. Programar para a próxima renovação se o meio suportar. Benefícios mudam após pagamento confirmado |
| Downgrade | Próxima renovação; cliente escolhe membros/aparelhos que permanecem |
| Cancelar renovação | Parar cobranças futuras no gateway e preservar `paidThrough`. Informar eventual redução das vagas globais, sem encerrar proxy |
| Reembolso ou disputa | Fluxo próprio com decisão e efeito explícito sobre o período. Arrependimento recebe confirmação quando aplicável |
| Período termina sem pagamento | Novas execuções SMS param; saldo/assinatura proxy elegível permanece |
| Reactivar | Não retomar mensagens vencidas ou suspensas sem revisão explícita |
| Suspensão por abuso | Parar novas autorizações; manter acesso permitido a cobrança, denúncia e exportação |

Cotação mostra data, preço e vagas no novo ciclo. Mudança imediata com cálculo proporcional fica para extensão independente. No fim do período, o proprietário conserva cobrança, histórico mascarado disponível e exportação autorizada dentro da janela do último plano pago. Conteúdo segue a própria retenção. Mostrar prazo e impacto antes de confirmar cancelamento ou redução. [Decreto 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm).

Ao reduzir capacidade sem seleção prévia: nunca remover dados nem proprietário. Suspender primeiro membros não proprietários mais recentes e aparelhos SMS habilitados mais recentemente até caber; emitir aviso e permitir seleção posterior. Remover acesso suspende também suas chaves, sem perder rastreabilidade. Convites excedentes são cancelados. Reativação de membros/aparelhos depende de seleção, não ocorre em massa automaticamente.

## Limites públicos de engenharia

Defaults preliminares configuráveis do piloto. Escrita até 10/min por chave e 60/min por conta. Leitura até 120/min por chave e 600/min por conta. Um destinatário por chamada, teto inicial de 100 pendentes por conta, máximo oito segmentos por mensagem e 1 MiB por requisição. Ajustar o teto de pendentes conforme validade e capacidade da linha. Lotes de até 100 destinos entram na expansão com prévia de atraso/expiração. Retornar erro específico e `Retry-After` para 429. Excedente operacional gera limite, sem tarifa adicional.

Para cada coorte, Produto e Financeiro registram antes do piloto amostra, duração, meta de ativação e renovação, orçamento de suporte e margem alvo. Usar R$ 5,17 de variáveis restantes no Inicial como hipótese com Pix de R$ 0,80 e teto variável de 30%. Separar custos de cadastro/revisão, manutenção, taxas, tributos e perdas. [Referência de taxas](https://www.abacatepay.com/duvidas/quanto-custa-a-abacatepay).

Esses números protegem o software, não autorizam a linha a enviar nessa velocidade. Política de envio por linha exige condições contratuais explícitas e usa o menor limite aplicável. Sem política autorizada, bloquear execução real. API pode aceitar uma agenda dentro dos limites de fila sem prometer envio imediato.

## Receita e custos

Registrar receita confirmada, taxas efetivas, impostos apurados, infraestrutura atribuída, minutos de suporte e custo de aquisição. Hipótese de piloto: custos variáveis <=30% da receita, a validar; não é margem comprovada. Cem contas Inicial geram R$ 1.990 brutos/mês. Relatório não lê texto de mensagens. Gate comercial deve confirmar que os planos baratos são sustentáveis e que atendimento assistido não é ilimitado.
