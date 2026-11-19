# HNS-38 — Validar pagamento real e liberar piloto pago do Inicial

Prioridade P0 · TODO · Fase PILOTO_PAGO · Responsável sugerido Financeiro, produto e QA

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-12](HNS-12.md)
- [HNS-34](HNS-34.md)
- [HNS-35](HNS-35.md)

## Requisitos e leitura obrigatória

R04, R12, R20, R21

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)
- [12-entrega-operacao.md](../12-entrega-operacao.md)

## Onde trabalhar

- `web/src/app/api/v1`
- `web/src/app/dashboard/sms`

## Passos de implementação

1. Validar cobrança controlada, recibo, cancelamento e direito pago no meio escolhido.
2. Publicar preço e limites do Inicial quando aprovados, com checklist de prontidão antes do checkout.
3. Conferir suporte, receita líquida, reembolsos e custo da coorte.
4. Exibir renovação, arrependimento quando aplicável e acesso pós-cancelamento.

## Critérios de aceite

- [ ] Preço e margem foram revistos com custos reais.
- [ ] Cliente apto paga e vê o período uma vez.
- [ ] Cancelamento do SMS preserva serviço proxy e informa efeito sobre vagas.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T11, T52, T57, T61 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
