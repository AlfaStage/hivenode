# HNS-21 — Implementar exportação, retenção e exclusão segura

Prioridade P1 · TODO · Fase EXPANSAO · Responsável sugerido Backend/infra com privacy

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-10](HNS-10.md)
- [HNS-18](HNS-18.md)
- [HNS-37](HNS-37.md)

## Requisitos e leitura obrigatória

R12, R16, R17

- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/lib/sms/jobs`
- `web/src/app/api/v1`
- `web/src/workers`

## Passos de implementação

1. Criar export job sem body por default, filtrar por escopos e prevenir CSV formula injection.
2. Revalidar conta/permissão no download, link5min/arquivo24h.
3. Implementar body purge7d pós-terminal/30d máximo, agenda necessária e retenção operacional por plano.
4. Redigir logs/caches/jobs e política de backups; não apagar supressões/financeiro por downgrade.

## Critérios de aceite

- [ ] Conteúdo purgado não continua exportável.
- [ ] Revogação bloqueia download antes de expiração do link.
- [ ] Histórico180d não retém texto por180d.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T39, T40, T53 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
