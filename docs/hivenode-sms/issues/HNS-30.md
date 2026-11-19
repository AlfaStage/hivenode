# HNS-30 — Automatizar testes do piloto e regressão do proxy

Prioridade P0 · TODO · Fase PILOTO_ASSISTIDO · Responsável sugerido QA/backend/infra

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-03](HNS-03.md)
- [HNS-18](HNS-18.md)
- [HNS-24](HNS-24.md)
- [HNS-26](HNS-26.md)
- [HNS-29](HNS-29.md)
- [HNS-37](HNS-37.md)

## Requisitos e leitura obrigatória

R20, R21, R22

- [11-testes.md](../11-testes.md)
- [12-entrega-operacao.md](../12-entrega-operacao.md)

## Onde trabalhar

- `web/package.json`
- `web/scripts`
- `broker/internal`
- `hivenode-app`
- `hivenode-light`
- `scripts`

## Passos de implementação

1. Rodar jornada do piloto em simulador, com E2E e casos negativos.
2. Rodar caos de banco/rede/modem fake e medir invocações físicas simuladas.
3. Executar carga agregada dentro de cotas e verificar 429 separadamente.
4. Rodar regressão de proxy e ativar as suítes de expansão junto com as respectivas entregas.

## Critérios de aceite

- [ ] Nenhum teste físico vira verde por mock.
- [ ] Duplicação observada e isolamento falho bloqueiam release.
- [ ] Falhas prévias ficam separadas e CI novo é reproduzível.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T01, T24, T41, T44, T47, T49, T55, T56, T58, T61 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
