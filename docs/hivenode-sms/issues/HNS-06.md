# HNS-06 — Implementar contexto de conta e autorização por serviço/recurso

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend/security

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-04](HNS-04.md) concluída e contratos revisados.
- [HNS-05](HNS-05.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R01, R03, R17. Ver [PRD](../01-prd.md).

- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/lib/auth.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/proxy.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/workspaces` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar requireWorkspaceContext e verificação deny-by-default para pessoa/API/device.
2. Resolver membership/grants reais; separar ADMIN global de proprietário da conta.
3. Scoped queries por ID+workspace e erros 401/403/404; cache versionado com revogação.
4. Criar matriz de acesso e helpers reutilizáveis nos canais; revisar Origem/CSRF.

## Critérios de aceite

- [ ] ID da conta não autentica acesso.
- [ ] Membro SMS-only não acessa proxy, conteúdo ou faturamento sem grant.
- [ ] Revogação bloqueia grant físico novo, mesmo com sessão/chave antiga.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T03, T06, T34, T43 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

