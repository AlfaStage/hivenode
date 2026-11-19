# HNS-19 — Criar lotes, templates, agenda e preview

Prioridade P1 · TODO · Fase EXPANSAO · Responsável sugerido Backend/web

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-15](HNS-15.md)
- [HNS-17](HNS-17.md)
- [HNS-18](HNS-18.md)

## Requisitos e leitura obrigatória

R08, R12

- [06-api-mcp.md](../06-api-mcp.md)
- [09-painel-jornadas.md](../09-painel-jornadas.md)

## Onde trabalhar

- `web/src/lib/sms`
- `web/src/app/api/v1`

## Passos de implementação

1. Criar templates versionados com variáveis validadas e rendering sem execução de expressão.
2. Lotes até100 com clientItemId único/destinos distintos; todo lote inválido não comita nada.
3. Agenda UTC/fuso e validade aplicadas por item; link optout no texto final.
4. Preview real do aparelho determina segmentos; estimativa web explicitamente indicativa.

## Critérios de aceite

- [ ] Erro em um item devolve422 e nenhum item persiste.
- [ ] Troca de modelo não modifica mensagem autorizada.
- [ ] Cada destino tem ID/estado próprio e paginação.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T17, T18, T27, T46, T53 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
