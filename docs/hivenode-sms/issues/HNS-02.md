# HNS-02 — Investigar Android, foreground service e canal de distribuição

Prioridade: P0 • Situação: TODO • Responsável sugerido: Mobile com revisão sênior

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- Sem dependência de código novo; usar a baseline documental e preservar alterações existentes.

## Requisitos e leitura obrigatória

Requisitos: R05, R18, R20. Ver [PRD](../01-prd.md).

- [08-android.md](../08-android.md)
- [03-arquitetura.md](../03-arquitetura.md)

## Onde trabalhar

- `hivenode-app/app.json` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-app/plugins/withNotifeeForegroundServiceType.js` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-light/android-app/app/build.gradle` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Inspecionar SDK/target gerados no app principal e toolchain Light; registrar matriz API26/31/34/35/36.
2. Avaliar opções legítimas FGS, reconciliação WorkManager e wake-up opcional; medir protótipo sem linha real.
3. Verificar permissões SEND_SMS/READ_PHONE_STATE e elegibilidade de distribuição Play/empresarial.
4. Registrar ADR com limites de segundo plano, force-stop, reboot e necessidade de abrir app; definir como exibir pausa.

## Critérios de aceite

- [ ] Não existe promessa 24/7 baseada só em dataSync/WakeLock.
- [ ] Baseline SMS API>=26 é aplicado sem impedir proxy em aparelhos antigos.
- [ ] ADR revisado por mobile experiente; físico ainda pendente.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T49, T50 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

