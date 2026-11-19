# HNS-24 — Integrar agente e telas SMS no app principal

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Mobile

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-23](HNS-23.md)
- [HNS-06](HNS-06.md)
- [HNS-13](HNS-13.md)

## Requisitos e leitura obrigatória

R05, R06, R12, R18

- [08-android.md](../08-android.md)
- [09-painel-jornadas.md](../09-painel-jornadas.md)

## Onde trabalhar

- `hivenode-app/src/app/index.tsx`
- `hivenode-app/src/app/_layout.tsx`
- `hivenode-app/plugins`

## Passos de implementação

1. Adicionar pareamento e confirmação local de revisão da linha.
2. Mostrar aparelho, SIM, sessão, disponibilidade, último contato e ação necessária.
3. Usar sessão visível no piloto com presença expirada, conciliação e retomada explícitas.
4. Registrar segurança de backup e validar troca de aparelho sem recuperar credencial ou fila.

## Critérios de aceite

- [ ] SMS funciona sem assinatura proxy e sem sessão de túnel.
- [ ] Revogação local pausa envio e mantém diagnóstico.
- [ ] App build/bridge validado; rede real aguarda proprietário.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T19, T30, T32, T49, T50, T55, T59 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
