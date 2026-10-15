# HNS-26 — Criar painel SMS, jornada de envio e resultados

Prioridade: P1 • Situação: TODO • Responsável sugerido: Web

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-06](HNS-06.md) concluída e contratos revisados.
- [HNS-13](HNS-13.md) concluída e contratos revisados.
- [HNS-15](HNS-15.md) concluída e contratos revisados.
- [HNS-18](HNS-18.md) concluída e contratos revisados.
- [HNS-19](HNS-19.md) concluída e contratos revisados.
- [HNS-20](HNS-20.md) concluída e contratos revisados.
- [HNS-21](HNS-21.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R12, R05, R09, R11. Ver [PRD](../01-prd.md).

- [09-painel-jornadas.md](../09-painel-jornadas.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/app/dashboard/sms` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/hooks` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/components` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar overview/devices/SIMs/compose/lote/templates/history/details/integrations.
2. Mostrar contagem/agenda/remetente/optout e confirmação antes de lote.
3. Distinguir SENT/DELIVERED/PARTIAL/UNKNOWN e ações de cancelamento/reenvio realistas.
4. Implementar acesso por grants, acessibilidade, cursor e states de carga/erro/purge.

## Critérios de aceite

- [ ] Membro não vê aparelhos/dados da conta anterior.
- [ ] Texto de diagnóstico expressa certeza e ação.
- [ ] Sem uso de admin global como atalho no teste de cliente.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T02, T33, T39, T54 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

