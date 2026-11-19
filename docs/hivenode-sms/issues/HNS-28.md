# HNS-28 — Entregar MCP remoto OAuth como extensão condicionada

Prioridade P2 · TODO · Fase EXPANSAO · Responsável sugerido Integrações/security; extensão opcional

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-22](HNS-22.md)
- [HNS-10](HNS-10.md)

## Requisitos e leitura obrigatória

R14, R13

- [06-api-mcp.md](../06-api-mcp.md)
- [13-decisoes-fontes.md](../13-decisoes-fontes.md)

## Onde trabalhar

- `mcp`

## Passos de implementação

1. Fixar spec estável e SDK por ADR, serviço persistente Streamable HTTP.
2. Implementar resource metadata/OAuth, issuer/audience/PKCE e consentimento com conta/scopes.
3. Negar token passthrough e confusão de sessão/tenant; testar clientes reais.
4. Manter flag off e stdio funcional enquanto extensão não for homologada.

## Critérios de aceite

- [ ] Endpoint remoto não depende de segredo colado em UI incompatível.
- [ ] Troca de conta não reutiliza scope de outra.
- [ ] Só anunciar remoto após testes de interoperabilidade.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T34, T35, T36 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
