# HNS-29 — Adicionar observabilidade, suporte e métricas de custo

Prioridade: P1 • Situação: TODO • Responsável sugerido: Infra/produto

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-12](HNS-12.md) concluída e contratos revisados.
- [HNS-18](HNS-18.md) concluída e contratos revisados.
- [HNS-20](HNS-20.md) concluída e contratos revisados.
- [HNS-21](HNS-21.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R11, R19, R21. Ver [PRD](../01-prd.md).

- [12-entrega-operacao.md](../12-entrega-operacao.md)
- [02-negocio-cobranca.md](../02-negocio-cobranca.md)

## Onde trabalhar

- `web/src/lib/sms` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/workers` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `docs` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar métricas redigidas de estados/outbox/DLQ/latência/device/receita/custos.
2. Separar tráfego SIMULATED/real, evitar labels de conteúdo/destinatário.
3. Implementar alertas de piloto e runbooks com ações seguras.
4. Medir minutos de suporte e margem real; revisar plano barato antes de público.

## Critérios de aceite

- [ ] Alertas contêm IDs técnicos sem secrets/PII.
- [ ] Receita é confirmada, custo é medido e hipótese não vira margem comprovada.
- [ ] Runbook UNKNOWN não orienta retry cego ou rotação de chip.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T31, T40, T41, T47 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

