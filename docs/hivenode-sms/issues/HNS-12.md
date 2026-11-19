# HNS-12 — Implementar cobrança SMS e conciliação após prova do gateway

Prioridade P0 · TODO · Fase PILOTO_PAGO · Responsável sugerido Backend/financeiro

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-08](HNS-08.md)
- [HNS-11](HNS-11.md)
- [HNS-35](HNS-35.md)

## Requisitos e leitura obrigatória

R04, R22

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)
- [12-entrega-operacao.md](../12-entrega-operacao.md)

## Onde trabalhar

- `web/src/lib/abacatepay.ts`
- `web/src/lib/payment-events.ts`
- `web/src/lib/billing-period.ts`
- `web/src/app/api/billing`

## Passos de implementação

1. Persistir intenção única antes da chamada externa com referência de conciliação.
2. Separar checkout, assinatura, parcela, snapshot e paidThrough. Validar valor, moeda, estado e ambiente.
3. Conciliar timeout, webhook antecipado, duplicatas e eventos fora de ordem.
4. Implementar um meio mensal validado, mudança no próximo ciclo quando suportada e cancelamento da renovação com efeito separado de estorno.

## Critérios de aceite

- [ ] Parcela duplicada não libera período adicional nem movimenta saldo proxy.
- [ ] Checkout e assinatura são associados por referência durável, mesmo quando evento chega cedo.
- [ ] Cancelamento conserva prazo pago. Novo mandato Pix só é ofertado com fluxo validado.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T11, T12, T13, T14, T52, T57 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
