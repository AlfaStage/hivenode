# HNS-27 — Criar seletor de conta, equipe e cobrança integrada

Prioridade: P1 • Situação: TODO • Responsável sugerido: Web

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-07](HNS-07.md) concluída e contratos revisados.
- [HNS-08](HNS-08.md) concluída e contratos revisados.
- [HNS-12](HNS-12.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R01, R02, R04, R12. Ver [PRD](../01-prd.md).

- [09-painel-jornadas.md](../09-painel-jornadas.md)
- [02-negocio-cobranca.md](../02-negocio-cobranca.md)

## Onde trabalhar

- `web/src/app/dashboard` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/dashboard/billing` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/dashboard/team` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Adicionar seletor conta que limpa queries/tickets antes de navegar.
2. Criar equipe/invite/grants/vagas/owner transfer e máscara de secrets.
3. Exibir cartões SMS/proxy independentes, quote/upgrade/downgrade/cancelAtPeriodEnd.
4. Selecionar excedentes antes do downgrade e informar efeitos no benefício global.

## Critérios de aceite

- [ ] Não cobrar membro duas vezes por serviços.
- [ ] Capacidade mostra maior plano elegível e OWNER contado.
- [ ] Cancelar SMS mantém proxy e prazo pago; invite races tratadas na UI.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T02, T05, T08, T11, T12, T33 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

