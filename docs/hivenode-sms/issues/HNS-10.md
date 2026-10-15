# HNS-10 — Criar API keys por conta, scopes e revogação

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend/security

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-06](HNS-06.md) concluída e contratos revisados.
- [HNS-07](HNS-07.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R13, R17. Ver [PRD](../01-prd.md).

- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/lib/workspaces` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/v1` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Gerar segredo forte, persistir hash/prefix e exibir uma vez.
2. Aplicar scopes/resources intersectados com grants vigentes do criador.
3. Implementar expiração/revogação/rotação e auditoria sem secrets.
4. Adicionar rate limits por chave+conta e contrato público de erros.

## Critérios de aceite

- [ ] Chave A não pode apontar para conta B.
- [ ] Remover criador bloqueia uso sem apagar histórico.
- [ ] Read-only não envia; segredo não aparece em GET/log.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T06, T16, T34, T46, T51 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

