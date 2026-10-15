# HNS-30 — Automatizar matriz completa, contratos, carga e chaos no CI

Prioridade: P0 • Situação: TODO • Responsável sugerido: QA/backend/infra

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-03](HNS-03.md) concluída e contratos revisados.
- [HNS-09](HNS-09.md) concluída e contratos revisados.
- [HNS-18](HNS-18.md) concluída e contratos revisados.
- [HNS-19](HNS-19.md) concluída e contratos revisados.
- [HNS-20](HNS-20.md) concluída e contratos revisados.
- [HNS-21](HNS-21.md) concluída e contratos revisados.
- [HNS-22](HNS-22.md) concluída e contratos revisados.
- [HNS-24](HNS-24.md) concluída e contratos revisados.
- [HNS-26](HNS-26.md) concluída e contratos revisados.
- [HNS-27](HNS-27.md) concluída e contratos revisados.
- [HNS-29](HNS-29.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R20, R21, R22. Ver [PRD](../01-prd.md).

- [11-testes.md](../11-testes.md)
- [12-entrega-operacao.md](../12-entrega-operacao.md)

## Onde trabalhar

- `web/package.json` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/scripts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `broker/internal` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-app` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-light` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `scripts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Executar T01–T54 automatizáveis, separar físicos/comerciais de evidências de CI.
2. Validar schema/OpenAPI contracts, authnegativos, concorrência e chaos após cada crash point.
3. Regredir proxy/CLI/HiveDocker/Miner/build; usar commits referenciados dos repos próprios.
4. Rodar carga alvo staging e publicar p95/ambiente/falhas sem modem; race Go em runner compatível.

## Critérios de aceite

- [ ] Nenhum teste físico vira verde por mock.
- [ ] Duplicação observada e isolamento falho bloqueiam release.
- [ ] Falhas prévias ficam separadas e CI novo é reproduzível.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T01, T24, T38, T43, T44, T47, T49 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

