# HNS-08 — Calcular entitlements independentes e capacidade global de equipe

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-04](HNS-04.md) concluída e contratos revisados.
- [HNS-06](HNS-06.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R02, R04, R22. Ver [PRD](../01-prd.md).

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)
- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)

## Onde trabalhar

- `web/src/lib/entitlements` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/worker.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/proxy-access.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar resolver elegível por período pago, cancelAtPeriodEnd, suspensão e trial.
2. Calcular max(1,benefícios), sem soma; planos proxy legados têm benefício 1.
3. Separar limite de aparelhos SMS/proxy e presença offline; locks na habilitação.
4. Aplicar downgrade selecionado ou fallback auditado sem apagar dados; revisões invalidam cache.

## Critérios de aceite

- [ ] SMS cancelado não derruba proxy elegível.
- [ ] Mais membros não aumenta limite de aparelhos ou GB.
- [ ] Downgrade preserva OWNER e explica seleção/suspensão de excedentes.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T08, T09, T11, T13 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

