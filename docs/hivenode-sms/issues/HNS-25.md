# HNS-25 — Modernizar Light e integrar SMS compatível sem perder proxy antigo

Prioridade P1 · TODO · Fase EXPANSAO · Responsável sugerido Mobile/Go

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-02](HNS-02.md)
- [HNS-17](HNS-17.md)
- [HNS-18](HNS-18.md)
- [HNS-23](HNS-23.md)

## Requisitos e leitura obrigatória

R05, R18, R22

- [08-android.md](../08-android.md)
- [03-arquitetura.md](../03-arquitetura.md)

## Onde trabalhar

- `hivenode-light/android-app`
- `hivenode-light/native-go/mobile`
- `hivenode-light/native-go/tunnel`

## Passos de implementação

1. Modernizar Gradle/SDK/wrapper/assinatura sem elevar mínimo proxy indevidamente; documentar JDK.
2. Implementar agente/executor Java com mesmos contratos/inbox/grants e feature guard API26.
3. Em API antiga anunciar smsSupported=false e evitar carregar classes inexistentes.
4. Preservar motor Go/Stop/KICKED/tunnel e testes; APK com hash e gate físico próprio.

## Critérios de aceite

- [ ] Não usar hack private dual SIM para API antiga.
- [ ] Principal e Light convergem em state/protocol.
- [ ] Light não homologado mantém SMS flag desligada e proxy disponível.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T30, T44, T49, T50 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
