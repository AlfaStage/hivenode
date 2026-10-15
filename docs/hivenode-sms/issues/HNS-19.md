# HNS-19 — Criar lotes, templates, agenda e preview

Prioridade: P1 • Situação: TODO • Responsável sugerido: Backend/web

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-15](HNS-15.md) concluída e contratos revisados.
- [HNS-17](HNS-17.md) concluída e contratos revisados.
- [HNS-18](HNS-18.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R08, R12. Ver [PRD](../01-prd.md).

- [06-api-mcp.md](../06-api-mcp.md)
- [09-painel-jornadas.md](../09-painel-jornadas.md)

## Onde trabalhar

- `web/src/lib/sms` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/v1` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar templates versionados com variáveis validadas e rendering sem execução de expressão.
2. Lotes até100 com clientItemId único/destinos distintos; todo lote inválido não comita nada.
3. Agenda UTC/fuso e validade aplicadas por item; link optout no texto final.
4. Preview real do aparelho determina segmentos; estimativa web explicitamente indicativa.

## Critérios de aceite

- [ ] Erro em um item devolve422 e nenhum item persiste.
- [ ] Troca de modelo não modifica mensagem autorizada.
- [ ] Cada destino tem ID/estado próprio e paginação.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T17, T18, T27, T46, T53 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

