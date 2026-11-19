# HNS-29 — Adicionar observabilidade, suporte e métricas de custo

Prioridade P1 · TODO · Fase PILOTO_ASSISTIDO · Responsável sugerido Infra/produto

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-18](HNS-18.md)
- [HNS-24](HNS-24.md)

## Requisitos e leitura obrigatória

R11, R19, R21

- [12-entrega-operacao.md](../12-entrega-operacao.md)
- [02-negocio-cobranca.md](../02-negocio-cobranca.md)

## Onde trabalhar

- `web/src/lib/sms`
- `web/src/workers`
- `docs`

## Passos de implementação

1. Medir latência, fila, chamadas ociosas do agente, UNKNOWN/PARTIAL e disponibilidade.
2. Separar evidência simulada de real e redigir logs.
3. Medir tempo de ativação, suporte, resultado por coorte e custo por plano.
4. Definir alertas e roteiros para pausa, recuperação segura e escalonamento.

## Critérios de aceite

- [ ] Alertas contêm IDs técnicos sem secrets/PII.
- [ ] Receita é confirmada, custo é medido e hipótese não vira margem comprovada.
- [ ] Runbook UNKNOWN não orienta retry cego ou rotação de chip.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T31, T40, T41, T47 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
