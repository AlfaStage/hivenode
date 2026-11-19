# HNS-14 — Implementar descadastro marketing e evidências de finalidade

Prioridade P0 · TODO · Fase EXPANSAO · Responsável sugerido Backend/web

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-06](HNS-06.md)
- [HNS-13](HNS-13.md)

## Requisitos e leitura obrigatória

R06, R16, R17

- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)
- [09-painel-jornadas.md](../09-painel-jornadas.md)

## Onde trabalhar

- `web/src/lib/sms/policies`
- `web/src/app/api/v1/sms/optout`
- `web/src/app/sms/optout`

## Passos de implementação

1. Criar supressão por conta+hash de destino e token opaco de descadastro.
2. GET mostra confirmação; POST bloqueia marketing idempotentemente sem login.
3. Inserir link antes do preview final e revalidar supressão no grant.
4. Registrar origem/adesão/reinscrição; CSV não limpa supressão; não pedir READ_SMS na v1.

## Critérios de aceite

- [ ] Descadastro bloqueia todos os chips/aparelhos da conta em marketing.
- [ ] Scanner GET não descadastra involuntariamente.
- [ ] Supressão não exige identidade/chave de envio nem expõe telefone em URL.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T18, T19, T40, T51 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
