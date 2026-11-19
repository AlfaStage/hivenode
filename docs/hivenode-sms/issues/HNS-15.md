# HNS-15 — Implementar serviço de mensagens, validação e idempotência

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-10](HNS-10.md)
- [HNS-13](HNS-13.md)

## Requisitos e leitura obrigatória

R06, R07, R08, R13, R17

- [06-api-mcp.md](../06-api-mcp.md)
- [07-fila-protocolo.md](../07-fila-protocolo.md)

## Onde trabalhar

- `web/src/lib/sms/service`
- `web/src/app/api/v1`
- `web/prisma/schema.prisma`

## Passos de implementação

1. Implementar envio transacional individual, consulta, cancelamento pendente e pausa.
2. Validar ator, conta, direito, finalidade, aparelho e SIM.
3. Gerar fingerprint da intenção original antes de defaults e persistir mensagem/idempotência atomicamente.
4. No replay revalidar autorização, devolver ID/estado e cabeçalho, sem criar mensagem novamente.

## Critérios de aceite

- [ ] POST concorrente idêntico cria uma mensagem.
- [ ] Reuso com intenção diferente retorna 409.
- [ ] Ato futuro como lote ou campanha depende da fase correspondente.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T15, T16, T19, T54, T56 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
