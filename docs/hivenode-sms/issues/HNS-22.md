# HNS-22 — Entregar MCP stdio com mesma política da REST

Prioridade P1 · TODO · Fase EXPANSAO · Responsável sugerido Integrações/backend

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-10](HNS-10.md)
- [HNS-15](HNS-15.md)
- [HNS-19](HNS-19.md)

## Requisitos e leitura obrigatória

R14, R13, R17

- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `mcp`
- `web/src/lib/sms/service`

## Passos de implementação

1. Criar bridge local com versão SDK fixada, API key protegida e workspace fixo.
2. Expor tools/schema/list/get/send/batch/cancel/pause/resume conforme contrato.
3. Reusar REST/application layer; idempotencyKey obrigatória nos sends.
4. Annotations, errors/requestId e logs sem token; tratar texto como dado não confiável.

## Critérios de aceite

- [ ] Chave read-only falha antes de mensagem persistir.
- [ ] REST e MCP convergem em resultado/erro.
- [ ] Nenhum endpoint remoto API-key-only é anunciado como OAuth interoperável.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T34, T35, T36, T51 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
