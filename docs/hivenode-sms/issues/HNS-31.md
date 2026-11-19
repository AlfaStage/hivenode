# HNS-31 — Ensaiar migração, backup e rollback com dados representativos

Prioridade P0 · TODO · Fase EXPANSAO · Responsável sugerido Backend/DBA com revisão

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-05](HNS-05.md)
- [HNS-09](HNS-09.md)
- [HNS-12](HNS-12.md)
- [HNS-30](HNS-30.md)

## Requisitos e leitura obrigatória

R01, R20, R22

- [04-dados-migracao.md](../04-dados-migracao.md)
- [12-entrega-operacao.md](../12-entrega-operacao.md)

## Onde trabalhar

- `web/prisma/migrations`
- `web/scripts`
- `docs/hivenode-sms`

## Passos de implementação

1. Restaurar backup em staging e reconciliar schema/baseline antes de migrar.
2. Ensaiar expand/backfill/dual-read/cutover com relatórios de conta/saldo/shares/financeiro.
3. Testar rollback por versão compatível após dados de equipe e novas mensagens.
4. Testar restore sem replay de modem e reaplicar supressões/retention/payments.

## Critérios de aceite

- [ ] Contagens/saldos idênticos ou divergências justificadas e aprovadas.
- [ ] Sem reset de produção ou restauração que descarte trabalho novo.
- [ ] Runbook assinado com comandos do ambiente e limites.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T01, T44, T48 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
