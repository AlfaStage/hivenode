# HNS-05 — Criar backfill idempotente e camada de compatibilidade legado

Prioridade P0 · TODO · Fase EXPANSAO · Responsável sugerido Backend com revisão de dados

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-03](HNS-03.md)
- [HNS-04](HNS-04.md)

## Requisitos e leitura obrigatória

R01, R22

- [04-dados-migracao.md](../04-dados-migracao.md)

## Onde trabalhar

- `web/scripts`
- `web/src/lib/transactions.ts`
- `web/src/lib/payment-events.ts`
- `web/src/lib/proxy-access.ts`

## Passos de implementação

1. Implementar backfill em lotes/checkpoints por migratedFromUserId; tratar SYSTEM e órfãos explicitamente.
2. Mapear recursos, shares, assinaturas e saldo para conta correta preservando IDs e valores.
3. Centralizar resolução user legado→conta padrão e dual-write financeiro transacional temporário.
4. Produzir relatório de contagens, divergências e retomada; testar execução simultânea/dupla.

## Critérios de aceite

- [ ] Duas execuções mantêm os mesmos IDs/contagens/saldos.
- [ ] Shares não fundem duas contas e não concedem SMS.
- [ ] Sem cobranças, novos períodos ou atribuição arbitrária de órfãos.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T01, T44, T48 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
