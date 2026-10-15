# HNS-03 — Preparar harness isolado, fixtures e simulador SMS

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend/QA

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- Sem dependência de código novo; usar a baseline documental e preservar alterações existentes.

## Requisitos e leitura obrigatória

Requisitos: R20, R21. Ver [PRD](../01-prd.md).

- [11-testes.md](../11-testes.md)
- [07-fila-protocolo.md](../07-fila-protocolo.md)

## Onde trabalhar

- `docker-compose.test.yml` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/scripts/test-env.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/scripts/local-integration.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/package.json` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar scripts test:sms:* e fixtures A/B/members/nodes/SIMs com runId.
2. Implementar fake modem e agente que persistem tentativa/eventos entre reinícios; nunca chamar Telephony ou SMS externo.
3. Implementar cenários listados no plano de testes com clock/seed e contagem de invocações físicas fake.
4. Adicionar configuração Playwright/contratos onde ausente e eliminar dependência de ws de outra pasta no novo harness.

## Critérios de aceite

- [ ] Simulador recusa APP_ENV=production e toda evidência é SIMULATED.
- [ ] Execução repete sem contaminar outras fixtures; secrets locais não alcançam produção.
- [ ] Scripts novos são documentados como existentes somente após commit.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T20, T24, T25, T27, T42 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

