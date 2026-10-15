# HNS-05 — Criar backfill idempotente e camada de compatibilidade legado

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend com revisão de dados

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-03](HNS-03.md) concluída e contratos revisados.
- [HNS-04](HNS-04.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R01, R22. Ver [PRD](../01-prd.md).

- [04-dados-migracao.md](../04-dados-migracao.md)

## Onde trabalhar

- `web/scripts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/transactions.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/payment-events.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/proxy-access.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Implementar backfill em lotes/checkpoints por migratedFromUserId; tratar SYSTEM e órfãos explicitamente.
2. Mapear recursos, shares, assinaturas e saldo para conta correta preservando IDs e valores.
3. Centralizar resolução user legado→conta padrão e dual-write financeiro transacional temporário.
4. Produzir relatório de contagens, divergências e retomada; testar execução simultânea/dupla.

## Critérios de aceite

- [ ] Duas execuções mantêm os mesmos IDs/contagens/saldos.
- [ ] Shares não fundem duas contas e não concedem SMS.
- [ ] Sem cobranças, novos períodos ou atribuição arbitrária de órfãos.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T01, T44, T48 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

