# HNS-21 — Implementar exportação, retenção e exclusão segura

Prioridade: P1 • Situação: TODO • Responsável sugerido: Backend/infra com privacy

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-10](HNS-10.md) concluída e contratos revisados.
- [HNS-18](HNS-18.md) concluída e contratos revisados.
- [HNS-20](HNS-20.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R12, R16, R17. Ver [PRD](../01-prd.md).

- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/lib/sms/jobs` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/v1` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/workers` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar export job sem body por default, filtrar por escopos e prevenir CSV formula injection.
2. Revalidar conta/permissão no download, link5min/arquivo24h.
3. Implementar body purge7d pós-terminal/30d máximo, agenda necessária e retenção operacional por plano.
4. Redigir logs/caches/jobs e política de backups; não apagar supressões/financeiro por downgrade.

## Critérios de aceite

- [ ] Conteúdo purgado não continua exportável.
- [ ] Revogação bloqueia download antes de expiração do link.
- [ ] Histórico180d não retém texto por180d.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T39, T40, T53 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

