# HNS-16 — Criar fila durável no PostgreSQL e worker de conciliação

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend/infra

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-03](HNS-03.md)
- [HNS-15](HNS-15.md)

## Requisitos e leitura obrigatória

R07, R08, R19

- [07-fila-protocolo.md](../07-fila-protocolo.md)
- [03-arquitetura.md](../03-arquitetura.md)

## Onde trabalhar

- `web/src/lib/sms/jobs`
- `web/src/workers`
- `web/package.json`

## Passos de implementação

1. Indexar pendências por conta, nó e disponibilidade.
2. Retirar com transação curta, SKIP LOCKED e exclusão de execução por aparelho.
3. Conciliar leases e grants vencidos periodicamente.
4. Preservar intenção em indisponibilidade do Redis. Reservar outbox para efeitos externos na expansão.

## Critérios de aceite

- [ ] Restart preserva pendências e dedup.
- [ ] Redis indisponível não elimina pedido nem concede autorização sem verificações.
- [ ] Expiração antes de grant vira EXPIRED.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T17, T20, T22, T42, T53 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
