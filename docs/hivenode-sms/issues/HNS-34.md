# HNS-34 — Liberar piloto controlado, kill switch e checklist operacional

Prioridade: P0 • Situação: TODO • Responsável sugerido: Responsável de release + proprietário

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-26](HNS-26.md) concluída e contratos revisados.
- [HNS-27](HNS-27.md) concluída e contratos revisados.
- [HNS-29](HNS-29.md) concluída e contratos revisados.
- [HNS-30](HNS-30.md) concluída e contratos revisados.
- [HNS-31](HNS-31.md) concluída e contratos revisados.
- [HNS-32](HNS-32.md) concluída e contratos revisados.
- [HNS-33](HNS-33.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R19, R20, R21, R22. Ver [PRD](../01-prd.md).

- [12-entrega-operacao.md](../12-entrega-operacao.md)
- [11-testes.md](../11-testes.md)

## Onde trabalhar

- `docs/hivenode-sms` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `configuração de staging/produção` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Revisar todos os gates/evidências; começar por allowlist de conta/nó/linha/destinos.
2. Testar kill switch sem perder eventos finais nem interromper proxy.
3. Definir responsáveis, alertas e rotina de suporte/custos; comunicar condições públicas aprovadas.
4. Só após autorização operacional publicar/deployar; registrar versão/flags/rollback e limitações.

## Critérios de aceite

- [ ] Sem produção por CI apenas; gates P/L exigidos.
- [ ] Nenhum backlog acumulado é disparado automaticamente na reativação.
- [ ] Relatório final distingue principal/Light/MCP stdio/remoto e cobertura real.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T41, T47, T48, T50, T52, T54 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

