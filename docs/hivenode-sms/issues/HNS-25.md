# HNS-25 — Modernizar Light e integrar SMS compatível sem perder proxy antigo

Prioridade: P1 • Situação: TODO • Responsável sugerido: Mobile/Go

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-02](HNS-02.md) concluída e contratos revisados.
- [HNS-17](HNS-17.md) concluída e contratos revisados.
- [HNS-18](HNS-18.md) concluída e contratos revisados.
- [HNS-23](HNS-23.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R05, R18, R22. Ver [PRD](../01-prd.md).

- [08-android.md](../08-android.md)
- [03-arquitetura.md](../03-arquitetura.md)

## Onde trabalhar

- `hivenode-light/android-app` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-light/native-go/mobile` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-light/native-go/tunnel` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Modernizar Gradle/SDK/wrapper/assinatura sem elevar mínimo proxy indevidamente; documentar JDK.
2. Implementar agente/executor Java com mesmos contratos/inbox/grants e feature guard API26.
3. Em API antiga anunciar smsSupported=false e evitar carregar classes inexistentes.
4. Preservar motor Go/Stop/KICKED/tunnel e testes; APK com hash e gate físico próprio.

## Critérios de aceite

- [ ] Não usar hack private dual SIM para API antiga.
- [ ] Principal e Light convergem em state/protocol.
- [ ] Light não homologado mantém SMS flag desligada e proxy disponível.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T30, T44, T49, T50 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

