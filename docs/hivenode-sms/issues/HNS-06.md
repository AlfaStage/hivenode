# HNS-06 — Implementar contexto de conta e autorização por serviço/recurso

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend/security

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-04](HNS-04.md)

## Requisitos e leitura obrigatória

R01, R03, R17

- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/lib/auth.ts`
- `web/src/proxy.ts`
- `web/src/lib/workspaces`

## Passos de implementação

1. Resolver identidade e conta de forma explícita, com OWNER no piloto.
2. Aplicar deny-by-default e 404 para recurso de outra conta.
3. Separar sessão humana, reautenticação recente, API key, revisor de linha e identidade de aparelho.
4. Criar matriz de segurança por rota e testar CSRF, escopos e revogação.

## Critérios de aceite

- [ ] ID da conta não autentica acesso.
- [ ] Membro SMS-only não acessa proxy, conteúdo ou faturamento sem grant.
- [ ] Revogação bloqueia grant físico novo, mesmo com sessão/chave antiga.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T03, T06, T34, T55, T56 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
