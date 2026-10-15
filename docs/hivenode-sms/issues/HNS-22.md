# HNS-22 — Entregar MCP stdio com mesma política da REST

Prioridade: P1 • Situação: TODO • Responsável sugerido: Integrações/backend

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-10](HNS-10.md) concluída e contratos revisados.
- [HNS-15](HNS-15.md) concluída e contratos revisados.
- [HNS-19](HNS-19.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R14, R13, R17. Ver [PRD](../01-prd.md).

- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `mcp` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/sms/service` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar bridge local com versão SDK fixada, API key protegida e workspace fixo.
2. Expor tools/schema/list/get/send/batch/cancel/pause/resume conforme contrato.
3. Reusar REST/application layer; idempotencyKey obrigatória nos sends.
4. Annotations, errors/requestId e logs sem token; tratar texto como dado não confiável.

## Critérios de aceite

- [ ] Chave read-only falha antes de mensagem persistir.
- [ ] REST e MCP convergem em resultado/erro.
- [ ] Nenhum endpoint remoto API-key-only é anunciado como OAuth interoperável.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T34, T35, T36, T51 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

