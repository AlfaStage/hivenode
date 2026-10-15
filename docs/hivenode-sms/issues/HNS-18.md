# HNS-18 — Implementar eventos, state machine, diagnóstico e reconciliação

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend com revisão de execução

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-03](HNS-03.md) concluída e contratos revisados.
- [HNS-17](HNS-17.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R09, R10, R11, R15. Ver [PRD](../01-prd.md).

- [07-fila-protocolo.md](../07-fila-protocolo.md)
- [11-testes.md](../11-testes.md)

## Onde trabalhar

- `web/src/lib/sms/state-machine` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/sms/diagnostics` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/workers` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Persistir/deduplicar eventos por eventId e node+epoch+sequence; ACK após commit.
2. Agregar resultado por segmento sem regredir estados com eventos fora de ordem.
3. Mapear certeza/categoria/retrySafe; UNKNOWN/PARTIAL nunca retry integral cego.
4. Implementar até3 tentativas só quando zero segmentos aceitos é comprovado, e reconciliar receipts tardios.

## Critérios de aceite

- [ ] SENT sem receipt continua enviado com entrega não confirmada.
- [ ] Evento repetido não reconta trial nem invoca modem.
- [ ] Generic failure não vira falta de crédito confirmada.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T24, T25, T26, T27, T28, T29, T31 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

