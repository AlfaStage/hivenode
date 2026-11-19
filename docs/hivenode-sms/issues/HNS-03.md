# HNS-03 — Preparar harness isolado, fixtures e simulador SMS

Prioridade P0 · TODO · Fase VIABILIDADE · Responsável sugerido Backend/QA

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- Pode iniciar com a documentação e o ambiente de teste.

## Requisitos e leitura obrigatória

R20, R21

- [11-testes.md](../11-testes.md)
- [07-fila-protocolo.md](../07-fila-protocolo.md)

## Onde trabalhar

- `docker-compose.test.yml`
- `web/scripts/test-env.ts`
- `web/scripts/local-integration.ts`
- `web/package.json`

## Passos de implementação

1. Criar scripts test:sms:* e fixtures A/B/members/nodes/SIMs com runId.
2. Implementar fake modem e agente que persistem tentativa/eventos entre reinícios; nunca chamar Telephony ou SMS externo.
3. Implementar cenários listados no plano de testes com clock/seed e contagem de invocações físicas fake.
4. Adicionar configuração Playwright/contratos onde ausente e eliminar dependência de ws de outra pasta no novo harness.

## Critérios de aceite

- [ ] Simulador recusa APP_ENV=production e toda evidência é SIMULATED.
- [ ] Execução repete sem contaminar outras fixtures; secrets locais não alcançam produção.
- [ ] Scripts novos são documentados como existentes somente após commit.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T20, T24, T25, T27, T42 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
