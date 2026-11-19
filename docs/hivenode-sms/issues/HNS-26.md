# HNS-26 — Criar painel do piloto com diagnóstico e envio individual

Prioridade P1 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Web

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-06](HNS-06.md)
- [HNS-13](HNS-13.md)
- [HNS-15](HNS-15.md)
- [HNS-18](HNS-18.md)
- [HNS-24](HNS-24.md)

## Requisitos e leitura obrigatória

R12, R05, R09, R11

- [09-painel-jornadas.md](../09-painel-jornadas.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/app/dashboard/sms`
- `web/src/hooks`
- `web/src/components`

## Passos de implementação

1. Construir jornada diagnóstico, termos, QR, chip, aprovação, teste controlado e prontidão.
2. Exibir último contato, bloqueio e próxima ação antes de permitir envio.
3. Mostrar remetente, destino mascarado, segmentos e distinção de envio e entrega.
4. Adicionar pausa/cancelamento pendente, consulta acessível e acesso por conta.

## Critérios de aceite

- [ ] Conta SMS-only conclui fluxo sem tela de compra de proxy.
- [ ] Resultado desconhecido ou parcial tem instrução clara.
- [ ] Teste começa apenas após prontidão e ativação.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T02, T33, T54, T55, T56, T61 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
