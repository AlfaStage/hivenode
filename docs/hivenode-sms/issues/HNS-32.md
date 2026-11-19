# HNS-32 — Homologar Android principal em aparelho e linha reais

Prioridade P0 · TODO · Fase PILOTO_ASSISTIDO · Responsável sugerido Proprietário + mobile/QA

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-24](HNS-24.md)
- [HNS-30](HNS-30.md)

## Requisitos e leitura obrigatória

R05, R09, R18, R20

- [11-testes.md](../11-testes.md)
- [08-android.md](../08-android.md)

## Onde trabalhar

- `hivenode-app`
- `hivenode-light`
- `docs/hivenode-sms/validation-status.json`

## Passos de implementação

1. Instalar APK assinado pelo canal previsto e registrar build, instalador, aparelho e Android.
2. Validar SEND_SMS, linha elegível, seleção de SIM, destino controlado e evidência de resultado.
3. Testar tela apagada, proxy simultâneo, reboot, force-stop, troca de SIM e restauração.
4. Registrar responsável, resultados por caso e limites de compatibilidade.

## Critérios de aceite

- [ ] Envio controlado no Android principal comprovado.
- [ ] Compatibilidade e funcionamento em segundo plano têm evidência.
- [ ] Light possui aceite independente e flags próprias.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T30, T49, T50, T54, T59 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
