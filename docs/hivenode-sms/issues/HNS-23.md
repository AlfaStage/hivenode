# HNS-23 — Criar módulo Android nativo, inbox e executor SMS

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Mobile; revisão sênior necessária

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-02](HNS-02.md)
- [HNS-17](HNS-17.md)
- [HNS-18](HNS-18.md)

## Requisitos e leitura obrigatória

R05, R09, R10, R18

- [08-android.md](../08-android.md)
- [07-fila-protocolo.md](../07-fila-protocolo.md)

## Onde trabalhar

- `hivenode-app/modules/hivenode-sms`
- `hivenode-app/app.json`

## Passos de implementação

1. Criar módulo Expo local e persistência Room/SQLite cifrada com Keystore.
2. Consultar inventário por APIs públicas e selecionar subscription explicitamente.
3. Implementar preview/grant verificado e INVOKING antes de modem; callbacks persistidos por segmento sem JS.
4. Testar fake modem, replay/fencing/epoch/crashes/multipart; build próprio com SDK/JDK.

## Critérios de aceite

- [ ] Método JS sem grant não consegue send físico.
- [ ] Reinício INVOKING não invoca de novo.
- [ ] Permissão negada/chip ausente não interrompe proxy; evidência nativa sem modem marcada.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T21, T24, T25, T27, T30, T49 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
