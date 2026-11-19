# HNS-02 — Investigar Android, foreground service e canal de distribuição

Prioridade P0 · TODO · Fase VIABILIDADE · Responsável sugerido Mobile com revisão sênior

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- Pode iniciar com a documentação e o ambiente de teste.

## Requisitos e leitura obrigatória

R05, R18, R20

- [08-android.md](../08-android.md)
- [03-arquitetura.md](../03-arquitetura.md)

## Onde trabalhar

- `hivenode-app/app.json`
- `hivenode-app/plugins/withNotifeeForegroundServiceType.js`
- `hivenode-light/android-app/app/build.gradle`

## Passos de implementação

1. Testar APK principal assinado e instalado pelo canal pretendido em aparelho real.
2. Verificar SEND_SMS no instalador e runtime, seleção de SIM e primeiro SMS controlado em linha elegível.
3. Medir sessão visível, tela apagada, retomada após reboot/force-stop e coexistência com proxy.
4. Documentar distribuição, verificação do desenvolvedor no Brasil e variante proxy sem SEND_SMS se necessária.

## Critérios de aceite

- [ ] Há evidência de build, instalador, modelo, Android e linha.
- [ ] Comportamento de segundo plano documentado sem prometer operação contínua.
- [ ] Light possui homologação própria e não bloqueia principal.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T49, T50, T59 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
