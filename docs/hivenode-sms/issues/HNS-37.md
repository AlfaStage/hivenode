# HNS-37 — Aplicar retenção mínima e proteção de cópias no piloto

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend, mobile e privacidade

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-18](HNS-18.md)
- [HNS-24](HNS-24.md)

## Requisitos e leitura obrigatória

R16, R17, R20

- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)
- [08-android.md](../08-android.md)
- [11-testes.md](../11-testes.md)

## Onde trabalhar

- `web/src/lib/sms`
- `hivenode-app/modules/hivenode-sms`

## Passos de implementação

1. Cifrar conteúdo, separar metadados e aplicar purga de texto.
2. Remover PII de logs e fila operacional e definir acesso ao histórico após encerramento.
3. Excluir fila e chaves nativas de backup e transferência.
4. Testar reinstalação e restauração sem reenvio, preservar evidências necessárias.

## Critérios de aceite

- [ ] Conteúdo expira sem perder auditoria mínima.
- [ ] Backup não transporta identidade ativa.
- [ ] Histórico Android e retenção HiveNode estão explicados na jornada.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T40, T53, T59 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
