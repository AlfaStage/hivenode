# HNS-33 — Validar elegibilidade, privacidade e distribuição para piloto assistido

Prioridade P0 · TODO · Fase PILOTO_ASSISTIDO · Responsável sugerido Produto/jurídico/financeiro

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-01](HNS-01.md)
- [HNS-02](HNS-02.md)
- [HNS-13](HNS-13.md)

## Requisitos e leitura obrigatória

R04, R06, R16, R17, R21

- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)
- [13-decisoes-fontes.md](../13-decisoes-fontes.md)

## Onde trabalhar

- `docs/hivenode-sms`
- `web/src/app/api/admin/plans`

## Passos de implementação

1. Confirmar linha elegível, operação transacional e destinos permitidos no piloto.
2. Obter revisão de termos, política de dados, evidências e canal de denúncias.
3. Confirmar distribuição aprovada, build e responsabilidades operacionais.
4. Definir como revisar, pausar e revogar linha, preservando trilha de decisão.

## Critérios de aceite

- [ ] Termos e linha têm evidência aceita pelos responsáveis.
- [ ] Canal escolhido está validado para a coorte.
- [ ] A autorização de cobrança tem aceite independente.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T19, T40, T52, T56, T59 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
