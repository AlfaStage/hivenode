# HNS-28 — Entregar MCP remoto OAuth como extensão condicionada

Prioridade: P2 • Situação: TODO • Responsável sugerido: Integrações/security; extensão opcional

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-22](HNS-22.md) concluída e contratos revisados.
- [HNS-10](HNS-10.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R14, R13. Ver [PRD](../01-prd.md).

- [06-api-mcp.md](../06-api-mcp.md)
- [13-decisoes-fontes.md](../13-decisoes-fontes.md)

## Onde trabalhar

- `mcp` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Fixar spec estável e SDK por ADR, serviço persistente Streamable HTTP.
2. Implementar resource metadata/OAuth, issuer/audience/PKCE e consentimento com conta/scopes.
3. Negar token passthrough e confusão de sessão/tenant; testar clientes reais.
4. Manter flag off e stdio funcional enquanto extensão não for homologada.

## Critérios de aceite

- [ ] Endpoint remoto não depende de segredo colado em UI incompatível.
- [ ] Troca de conta não reutiliza scope de outra.
- [ ] Só anunciar remoto após testes de interoperabilidade.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T34, T35, T36 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

