# HNS-01 — Validar contratos do produto, preços e gates de lançamento

Prioridade P0 · TODO · Fase VIABILIDADE · Responsável sugerido Produto/comercial com revisão jurídica; junior organiza evidências

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- Pode iniciar com a documentação e o ambiente de teste.

## Requisitos e leitura obrigatória

R04, R06, R17, R21

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)
- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)
- [13-decisoes-fontes.md](../13-decisoes-fontes.md)

## Onde trabalhar

- `docs/hivenode-sms`
- `web/src/app/api/admin/plans/route.ts`

## Passos de implementação

1. Definir coorte transacional, destinos controlados e oferta do Inicial.
2. Registrar preço como hipótese, estimar custo por conta e por aparelho e fixar metas de suporte/margem/ativação.
3. Revisar verificação antes de teste/checkout, texto comercial e limites.
4. Designar responsáveis por requisitos da linha, termos e escalonamento de denúncias.

## Critérios de aceite

- [ ] Baseline e pendências têm dono, saída e gate; sem promessa de aprovação jurídica ou envio ilimitado da operadora.
- [ ] Valores são snapshots por período; plano proxy antigo conserva benefício 1 até revisão.
- [ ] Nada foi publicado nem cobrado nesta issue.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T19, T46, T52, T61 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
