# HNS-18 — Implementar eventos, state machine, diagnóstico e reconciliação

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend com revisão de execução

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-03](HNS-03.md)
- [HNS-17](HNS-17.md)

## Requisitos e leitura obrigatória

R09, R10, R11, R15

- [07-fila-protocolo.md](../07-fila-protocolo.md)
- [11-testes.md](../11-testes.md)

## Onde trabalhar

- `web/src/lib/sms/state-machine`
- `web/src/lib/sms/diagnostics`
- `web/src/workers`

## Passos de implementação

1. Gravar eventos e responder por ID com aceite, duplicata, rejeição permanente ou retry.
2. Tipar pré-checagem antes de INVOKING, resultado de envio e interpretação do recibo.
3. Conciliar fora de ordem, liberar vaga do aparelho no resultado ou prazo e bloquear retry de UNKNOWN/PARTIAL.
4. Aceitar retry automático só em pré-checagem transitória comprovada antes da chamada nativa.

## Critérios de aceite

- [ ] SENT sem receipt continua enviado com entrega não confirmada.
- [ ] Evento repetido não reconta trial nem invoca modem.
- [ ] Generic failure não vira falta de crédito confirmada.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T24, T25, T26, T27, T28, T29, T31, T41, T58 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
