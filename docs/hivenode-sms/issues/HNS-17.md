# HNS-17 — Implementar API de aparelho, lease e grants assinados

Prioridade P0 · TODO · Fase FLUXO_VERTICAL · Responsável sugerido Backend/security; revisão obrigatória

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-13](HNS-13.md)
- [HNS-15](HNS-15.md)
- [HNS-16](HNS-16.md)

## Requisitos e leitura obrigatória

R06, R07, R10, R13, R18

- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)
- [07-fila-protocolo.md](../07-fila-protocolo.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/lib/sms/device`
- `web/src/app/api/device/v1`

## Passos de implementação

1. Autenticar instalação e requests assinadas a partir do pareamento.
2. Criar lease reproduzível com hash e cópia cifrada curta.
3. Emitir grant de 30s vinculado à versão da linha, segmentos, texto, destino e sessão ativa.
4. Revalidar limites e política no mesmo ponto de autorização. Descadastro concorrente prevalece enquanto LEASED.

## Critérios de aceite

- [ ] Nó não pede tentativa/grant de outro nó.
- [ ] Lease vencido após grant gera UNKNOWN, não redispatch.
- [ ] Kill switch e DB indisponível impedem novo grant; evento final continua aceito.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T18, T20, T21, T23, T41, T54, T55, T56 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
