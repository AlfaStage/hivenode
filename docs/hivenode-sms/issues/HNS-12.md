# HNS-12 — Investigar gateway e implementar ciclo financeiro SMS isolado

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend/financeiro

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-08](HNS-08.md) concluída e contratos revisados.
- [HNS-11](HNS-11.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R04, R22. Ver [PRD](../01-prd.md).

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)
- [12-entrega-operacao.md](../12-entrega-operacao.md)

## Onde trabalhar

- `web/src/lib/abacatepay.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/payment-events.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/billing-period.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/billing` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Entregar matriz sandbox/real de recorrência/cancelamento/upgrade/proration/Pix; ADR de fallback explícito.
2. Implementar quote exp15min, delta em centavos e change idempotente liberado só por confirmação financeira.
3. Cancelar renovação preservando período pago e direitos; downgrade próximo ciclo.
4. Processar duplicados/fora de ordem/refund/chargeback sem somar período/GB SMS; reconciliar external payment identity.

## Critérios de aceite

- [ ] Evento duplicado concede um período.
- [ ] URL de retorno não libera assinatura.
- [ ] Cancelamento SMS não afeta proxy; gateway sem feature não é simulado como sucesso.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T11, T12, T13, T14, T52 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

