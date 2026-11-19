# HNS-34 — Liberar piloto assistido e testar pausa operacional

Prioridade P0 · TODO · Fase PILOTO_ASSISTIDO · Responsável sugerido Responsável de release + proprietário

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-29](HNS-29.md)
- [HNS-30](HNS-30.md)
- [HNS-32](HNS-32.md)
- [HNS-33](HNS-33.md)

## Requisitos e leitura obrigatória

R19, R20, R21, R22

- [12-entrega-operacao.md](../12-entrega-operacao.md)
- [11-testes.md](../11-testes.md)

## Onde trabalhar

- `docs/hivenode-sms`
- `configuração de staging/produção`

## Passos de implementação

1. Liberar somente contas, nós, linhas e destinos autorizados.
2. Testar kill switch em staging preservando eventos finais conforme disponibilidade do DB.
3. Registrar indicadores, apoio da coorte e critérios para ampliar ou interromper.
4. Ensaiar rollback compatível do SMS e confirmar continuidade do proxy.

## Critérios de aceite

- [ ] Piloto conta com evidência física, conformidade, controles e regressão proxy.
- [ ] Apresentação do produto informa sessão e limitações do Android.
- [ ] Cobrança do Inicial entra pelo aceite do piloto pago.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T41, T47, T50, T52, T54, T59, T61 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
