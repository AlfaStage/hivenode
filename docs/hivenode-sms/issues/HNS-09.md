# HNS-09 — Migrar autorização proxy, broker, realtime e clients legados

Prioridade: P0 • Situação: TODO • Responsável sugerido: Go/backend; revisão de compatibilidade

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-05](HNS-05.md) concluída e contratos revisados.
- [HNS-06](HNS-06.md) concluída e contratos revisados.
- [HNS-08](HNS-08.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R03, R22. Ver [PRD](../01-prd.md).

- [03-arquitetura.md](../03-arquitetura.md)
- [04-dados-migracao.md](../04-dados-migracao.md)
- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)

## Onde trabalhar

- `web/src/lib/proxy-access.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/internal` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/dashboard-ticket` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `broker/internal/tunnel` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivedocker` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hiveminer-app` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Migrar resolver proxy para conta/beneficiário com compatibilidade de credenciais e shares.
2. Atualizar tickets realtime single-use com conta/ator/resources/revisão; filtrar antes do broadcast.
3. Preservar DIAL/TCP binário, cobrança de bytes e frota pública; não condicionar SMS ao proxy.
4. Regredir pareamento/login/admin/CLI/HiveDocker/Miner; registrar commits de repos próprios.

## Critérios de aceite

- [ ] Permissões da equipe valem proxy sem confundir dono com funcionário.
- [ ] Shares/público/saldo continuam corretos e jamais autorizam SMS.
- [ ] Eventos e credenciais de outra conta não vazam.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T04, T32, T43, T44, T45 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

