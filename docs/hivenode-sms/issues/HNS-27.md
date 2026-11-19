# HNS-27 — Criar seletor de conta, equipe e cobrança integrada

Prioridade P1 · TODO · Fase EXPANSAO · Responsável sugerido Web

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-07](HNS-07.md)
- [HNS-08](HNS-08.md)
- [HNS-12](HNS-12.md)

## Requisitos e leitura obrigatória

R01, R02, R04, R12

- [09-painel-jornadas.md](../09-painel-jornadas.md)
- [02-negocio-cobranca.md](../02-negocio-cobranca.md)

## Onde trabalhar

- `web/src/app/dashboard`
- `web/src/app/dashboard/billing`
- `web/src/app/dashboard/team`

## Passos de implementação

1. Adicionar seletor conta que limpa queries/tickets antes de navegar.
2. Criar equipe/invite/grants/vagas/owner transfer e máscara de secrets.
3. Exibir cartões SMS/proxy independentes, quote/upgrade/downgrade/cancelAtPeriodEnd.
4. Selecionar excedentes antes do downgrade e informar efeitos no benefício global.

## Critérios de aceite

- [ ] Não cobrar membro duas vezes por serviços.
- [ ] Capacidade mostra maior plano elegível e OWNER contado.
- [ ] Cancelar SMS mantém proxy e prazo pago; invite races tratadas na UI.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T02, T05, T08, T11, T12, T33 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
