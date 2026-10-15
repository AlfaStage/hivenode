# HNS-31 — Ensaiar migração, backup e rollback com dados representativos

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend/DBA com revisão

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-05](HNS-05.md) concluída e contratos revisados.
- [HNS-09](HNS-09.md) concluída e contratos revisados.
- [HNS-12](HNS-12.md) concluída e contratos revisados.
- [HNS-30](HNS-30.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R01, R20, R22. Ver [PRD](../01-prd.md).

- [04-dados-migracao.md](../04-dados-migracao.md)
- [12-entrega-operacao.md](../12-entrega-operacao.md)

## Onde trabalhar

- `web/prisma/migrations` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/scripts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `docs/hivenode-sms` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Restaurar backup em staging e reconciliar schema/baseline antes de migrar.
2. Ensaiar expand/backfill/dual-read/cutover com relatórios de conta/saldo/shares/financeiro.
3. Testar rollback por versão compatível após dados de equipe e novas mensagens.
4. Testar restore sem replay de modem e reaplicar supressões/retention/payments.

## Critérios de aceite

- [ ] Contagens/saldos idênticos ou divergências justificadas e aprovadas.
- [ ] Sem reset de produção ou restauração que descarte trabalho novo.
- [ ] Runbook assinado com comandos do ambiente e limites.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T01, T44, T48 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

