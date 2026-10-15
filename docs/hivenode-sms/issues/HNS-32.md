# HNS-32 — Homologar APKs e chips reais com o proprietário

Prioridade: P0 • Situação: TODO • Responsável sugerido: Proprietário + mobile/QA

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-24](HNS-24.md) concluída e contratos revisados.
- [HNS-25](HNS-25.md) concluída e contratos revisados.
- [HNS-30](HNS-30.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R05, R09, R18, R20. Ver [PRD](../01-prd.md).

- [11-testes.md](../11-testes.md)
- [08-android.md](../08-android.md)

## Onde trabalhar

- `hivenode-app` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-light` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `docs/hivenode-sms/validation-status.json` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Entregar APKs identificados/hash e roteiro; agendar somente quando proprietário informar disponibilidade.
2. Testar poucos destinos controlados com linha elegível, SIM1/SIM2/eSIM conforme hardware.
3. Executar background/reboot/force-stop/permissão/removedSIM/multipart e proxy simultâneo.
4. Registrar PASSOU/FALHOU/BLOQUEADO/NAO_EXECUTADO por modelo; compatibilidade limitada quando necessário.
5. Aguardar teste físico do proprietário daqui a alguns dias; não substituir pelo simulador nem inventar data.

## Critérios de aceite

- [ ] Gate físico não é aprovado antes dos testes do proprietário.
- [ ] Build/modelo/Android/linha documentados sem secrets.
- [ ] Light não aprovado não é anunciado como SMS funcional; sua flag permanece off.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T30, T49, T50, T54 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

