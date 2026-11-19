# HNS-07 — Criar convites, gerenciamento de membros e transferência de OWNER

Prioridade P0 · TODO · Fase EXPANSAO · Responsável sugerido Backend

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-06](HNS-06.md)
- [HNS-08](HNS-08.md)

## Requisitos e leitura obrigatória

R02, R03, R17

- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)
- [02-negocio-cobranca.md](../02-negocio-cobranca.md)

## Onde trabalhar

- `web/src/app/api/v1`
- `web/src/lib/workspaces`

## Passos de implementação

1. Implementar convites, aceite e gestão conforme contrato.
2. Reservar vaga em transação durante 72h e persistir apenas hash do token.
3. Entregar token de uso único à caixa do endereço convidado e exigir sessão no mesmo endereço.
4. Reautenticar para transferência de OWNER e revogar grants do membro removido sem apagar histórico.

## Critérios de aceite

- [ ] Concorrência na última vaga libera um único convite.
- [ ] OWNER nunca é removido por downgrade ou DELETE simples.
- [ ] Pessoa em outra conta conserva sessão daquela conta.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T05, T06, T07, T08 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
