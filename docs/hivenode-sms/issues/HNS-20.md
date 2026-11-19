# HNS-20 — Criar endpoints e entregas de webhook com SSRF e replay

Prioridade P1 · TODO · Fase EXPANSAO · Responsável sugerido Backend/security

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-10](HNS-10.md)
- [HNS-18](HNS-18.md)

## Requisitos e leitura obrigatória

R15, R16

- [06-api-mcp.md](../06-api-mcp.md)
- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)

## Onde trabalhar

- `web/src/lib/sms/webhooks`
- `web/src/workers`
- `web/src/app/api/v1`

## Passos de implementação

1. Validar URL/DNS/IP na configuração e em cada conexão, incluindo IPv6/rebinding.
2. Assinar body exato com timestamp e evento; cifrar secret e exibir uma vez.
3. Implementar 8 tentativas, timeout10s,410 disable, DLQ/status e replay de evento.
4. Enviar payload redigido, escopado por conta e tipo; sem corpo de SMS por padrão.

## Critérios de aceite

- [ ] Redirect não contorna bloqueio de rede interna.
- [ ] Duplicação at-least-once documentada e eventId estável.
- [ ] Replay webhook não cria mensagem nem tentativa SMS.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T37, T38, T40 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
