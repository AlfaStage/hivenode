# HNS-04 — Criar contas e ownership aditivos para SMS

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend; revisão de migração

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-01](HNS-01.md)

## Requisitos e leitura obrigatória

R01, R02, R03, R04

- [04-dados-migracao.md](../04-dados-migracao.md)
- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)

## Onde trabalhar

- `web/prisma/schema.prisma`
- `web/prisma/migrations`

## Passos de implementação

1. Criar Workspace, OWNER e vínculo com usuário existente apenas para contas participantes.
2. Adicionar tabelas SMS e FKs compostas por conta, aparelho e SIM.
3. Garantir exatamente um proprietário ativo inclusive em transferência concorrente.
4. Preparar snapshots de entitlement e billing SMS isolados, preservando dados de proxy legados.

## Critérios de aceite

- [ ] Migração não exige reset ou db push.
- [ ] FK entre contas é rejeitada; OWNER e campos financeiros têm integridade.
- [ ] Cliente legado continua funcionando com código compatível.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T01, T03, T07, T48 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
