# HNS-23 — Criar módulo Android nativo, inbox e executor SMS

Prioridade: P0 • Situação: TODO • Responsável sugerido: Mobile; revisão sênior necessária

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-02](HNS-02.md) concluída e contratos revisados.
- [HNS-17](HNS-17.md) concluída e contratos revisados.
- [HNS-18](HNS-18.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R05, R09, R10, R18. Ver [PRD](../01-prd.md).

- [08-android.md](../08-android.md)
- [07-fila-protocolo.md](../07-fila-protocolo.md)

## Onde trabalhar

- `hivenode-app/modules/hivenode-sms` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-app/app.json` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar módulo Expo local e persistência Room/SQLite cifrada com Keystore.
2. Consultar inventário por APIs públicas e selecionar subscription explicitamente.
3. Implementar preview/grant verificado e INVOKING antes de modem; callbacks persistidos por segmento sem JS.
4. Testar fake modem, replay/fencing/epoch/crashes/multipart; build próprio com SDK/JDK.

## Critérios de aceite

- [ ] Método JS sem grant não consegue send físico.
- [ ] Reinício INVOKING não invoca de novo.
- [ ] Permissão negada/chip ausente não interrompe proxy; evidência nativa sem modem marcada.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T21, T24, T25, T27, T30, T49 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

