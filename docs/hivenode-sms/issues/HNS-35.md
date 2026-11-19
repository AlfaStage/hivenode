# HNS-35 — Provar o contrato da AbacatePay em sandbox

Prioridade P0 · TODO · Fase VIABILIDADE · Responsável sugerido Backend e financeiro

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- Pode iniciar com a documentação e o ambiente de teste.

## Requisitos e leitura obrigatória

R04, R21

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)

## Onde trabalhar

- `web/src/lib/abacatepay.ts`
- `web/src/lib/payment-events.ts`

## Passos de implementação

1. Validar meios disponíveis na conta e escolher um meio mensal.
2. Registrar referências local, checkout, assinatura e parcela nos exemplos redigidos.
3. Reproduzir eventos adiantados, duplicados, cancelamento e estorno.
4. Provar troca no próximo ciclo e documentar novo mandato no Pix quando aplicável.

## Critérios de aceite

- [ ] Matriz da conta tem evidência para o meio escolhido.
- [ ] Sem uso de cobrança real neste experimento.
- [ ] Comportamento ausente permanece fora da oferta do piloto.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T12, T14, T57 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
