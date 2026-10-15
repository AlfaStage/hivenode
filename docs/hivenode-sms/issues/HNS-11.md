# HNS-11 — Adicionar catálogo SMS, habilitação por aparelho e trial transacional

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-01](HNS-01.md) concluída e contratos revisados.
- [HNS-08](HNS-08.md) concluída e contratos revisados.
- [HNS-10](HNS-10.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R04, R06, R21. Ver [PRD](../01-prd.md).

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)
- [04-dados-migracao.md](../04-dados-migracao.md)

## Onde trabalhar

- `web/prisma/schema.prisma` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/admin/plans` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/entitlements` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Adicionar categoria SMS e slugs/centavos/limites snapshot de catálogo.
2. Implementar habilitação SMS exclusiva BYOD PRIVATE com capacidade sob lock.
3. Criar trial 7 dias/1 aparelho/100 segmentos e reserva idempotente por tentativa.
4. Garantir que quota trial incerta fica reservada; paid não debita por mensagem/GB.

## Critérios de aceite

- [ ] Dois chips não consomem duas vagas.
- [ ] Nenhuma ativação SMS via NodeShare ou node PUBLIC.
- [ ] Teste não converte automaticamente em assinatura paga.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T09, T10, T19, T45 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

