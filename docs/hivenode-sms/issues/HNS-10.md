# HNS-10 — Criar API keys por conta, scopes e revogação

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend/security

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-06](HNS-06.md)

## Requisitos e leitura obrigatória

R13, R17

- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/lib/workspaces`
- `web/src/app/api/v1`

## Passos de implementação

1. Emitir chave escopada a conta, aparelho e operações do piloto.
2. Armazenar hash e exibir segredo uma vez.
3. Intersectar escopos da chave com permissões vigentes e revogar quando perder acesso.
4. Reservar gestão de chaves a sessões humanas e limitar consumo por chave e conta.

## Critérios de aceite

- [ ] Chave A não pode apontar para conta B.
- [ ] Remover criador bloqueia uso sem apagar histórico.
- [ ] Read-only não envia; segredo não aparece em GET/log.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T06, T16, T34, T46, T51, T56 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
