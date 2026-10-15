# HNS-04 — Adicionar schema de contas, memberships e billing por conta

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend; revisão de migração

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-01](HNS-01.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R01, R02, R03, R04. Ver [PRD](../01-prd.md).

- [04-dados-migracao.md](../04-dados-migracao.md)
- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)

## Onde trabalhar

- `web/prisma/schema.prisma` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/prisma/migrations` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar Workspace/Membership/Invitation/Grant/BillingAccount/DeviceService com índices e FKs compostas.
2. Adicionar workspaceId nullable em recursos existentes, snapshots e versionamento sem remover userId.
3. Garantir OWNER único, constraints de capacidade e cascades que não apaguem empresa ao remover funcionário.
4. Gerar migração aditiva e revisão do SQL em banco limpo e cópia representativa.

## Critérios de aceite

- [ ] Migração não exige reset ou db push.
- [ ] FK entre contas é rejeitada; OWNER e campos financeiros têm integridade.
- [ ] Cliente legado continua funcionando com código compatível.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T01, T03, T07, T48 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

