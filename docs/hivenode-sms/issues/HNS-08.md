# HNS-08 — Calcular entitlements independentes e capacidade global de equipe

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-04](HNS-04.md)
- [HNS-06](HNS-06.md)

## Requisitos e leitura obrigatória

R02, R04, R22

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)
- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)

## Onde trabalhar

- `web/src/lib/entitlements`
- `web/src/lib/worker.ts`
- `web/src/lib/proxy-access.ts`

## Passos de implementação

1. Criar resolver elegível por período pago, cancelAtPeriodEnd, suspensão e trial.
2. Calcular max(1,benefícios), sem soma; planos proxy legados têm benefício 1.
3. Separar limite de aparelhos SMS/proxy e presença offline; locks na habilitação.
4. Aplicar downgrade selecionado ou fallback auditado sem apagar dados; revisões invalidam cache.

## Critérios de aceite

- [ ] SMS cancelado não derruba proxy elegível.
- [ ] Mais membros não aumenta limite de aparelhos ou GB.
- [ ] Downgrade preserva OWNER e explica seleção/suspensão de excedentes.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T08, T09, T11, T13 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
