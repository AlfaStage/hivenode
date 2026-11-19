# HNS-13 — Implementar pareamento SMS-only, termos e aprovação de linha

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend/mobile com compliance

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-02](HNS-02.md)
- [HNS-06](HNS-06.md)
- [HNS-11](HNS-11.md)

## Requisitos e leitura obrigatória

R05, R06, R17

- [08-android.md](../08-android.md)
- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)

## Onde trabalhar

- `web/src/lib/sms/policies`
- `web/src/app/api/device/v1`
- `web/src/app/api/v1`

## Passos de implementação

1. Criar QR de uso único por conta, serviço e desafio, com resgate HTTPS e credencial do aparelho independente do proxy.
2. Criar aceite versionado por sessão humana e publicar inventário/diagnóstico.
3. Separar evidência do cliente de decisão do revisor, com histórico e validade.
4. Exigir confirmação nativa de SIM, instalação e revisão aprovada. Revogar vínculo anterior na troca.

## Critérios de aceite

- [ ] Conta SMS-only pareia sem adquirir proxy.
- [ ] Evidência ou clique do cliente não habilita a linha.
- [ ] Reutilização de QR, outra conta ou revisão vencida impede grant.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T19, T30, T45, T51, T55, T56 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
