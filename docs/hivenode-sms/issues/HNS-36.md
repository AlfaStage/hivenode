# HNS-36 — Homologar Light em etapa independente

Prioridade P0 · TODO · Fase EXPANSAO · Responsável sugerido Mobile e QA

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-25](HNS-25.md)
- [HNS-32](HNS-32.md)

## Requisitos e leitura obrigatória

R05, R18, R20, R22

- [08-android.md](../08-android.md)
- [11-testes.md](../11-testes.md)

## Onde trabalhar

- `hivenode-light/android-app`

## Passos de implementação

1. Gerar APK assinado compatível com instalação do Android alvo.
2. Validar canal e permissões com linha elegível.
3. Rodar roteiro físico e regressão proxy-only.
4. Publicar matriz de suporte e controlar flag própria.

## Critérios de aceite

- [ ] Light e Android principal têm evidências independentes.
- [ ] Aparelho incompatível mantém comportamento de proxy suportado.
- [ ] Flag SMS Light só é ligada para builds aprovados.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T49, T50, T59 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
