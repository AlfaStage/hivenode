# HNS-16 — Criar outbox, workers, agenda e recuperação Redis

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend/infra

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-03](HNS-03.md) concluída e contratos revisados.
- [HNS-15](HNS-15.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R07, R08, R19. Ver [PRD](../01-prd.md).

- [07-fila-protocolo.md](../07-fila-protocolo.md)
- [03-arquitetura.md](../03-arquitetura.md)

## Onde trabalhar

- `web/src/lib/sms/jobs` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/workers` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/package.json` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar publisher/worker separados do tick atual, jobs sem corpo e IDs sem dois-pontos.
2. Reconciliar intents persistidas após queda; atualizar disponibilidade no banco.
3. Implementar schedule/expiry e transações concorrentes com CAS/locks.
4. Adicionar DLQ e replay administrativo que não equivale a resend físico; graceful shutdown.

## Critérios de aceite

- [ ] Redis offline após commit não perde a mensagem.
- [ ] Repetir job não cria grant/modem novo por si só.
- [ ] Expiração antes de grant vira EXPIRED.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T17, T22, T42, T53 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

