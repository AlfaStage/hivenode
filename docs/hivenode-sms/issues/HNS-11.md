# HNS-11 — Adicionar catálogo SMS, habilitação por aparelho e trial transacional

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-01](HNS-01.md)
- [HNS-08](HNS-08.md)

## Requisitos e leitura obrigatória

R04, R06, R21

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)
- [04-dados-migracao.md](../04-dados-migracao.md)

## Onde trabalhar

- `web/prisma/schema.prisma`
- `web/src/app/api/admin/plans`
- `web/src/lib/entitlements`

## Passos de implementação

1. Registrar catálogo SMS separado de proxy, com Inicial como primeira oferta paga.
2. Contar vaga por aparelho habilitado, com instalação substituída desabilitada.
3. Controlar teste de prontidão único e trial de sete dias após verificação e ação explícita.
4. Reservar segmentos por tentativa e manter reserva quando resultado for incerto.

## Critérios de aceite

- [ ] Dois chips não consomem duas vagas.
- [ ] Nenhuma ativação SMS via NodeShare ou node PUBLIC.
- [ ] Teste não converte automaticamente em assinatura paga.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T09, T10, T19, T45, T61 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
