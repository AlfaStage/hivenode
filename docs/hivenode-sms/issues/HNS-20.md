# HNS-20 — Criar endpoints e entregas de webhook com SSRF e replay

Prioridade: P1 • Situação: TODO • Responsável sugerido: Backend/security

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-10](HNS-10.md) concluída e contratos revisados.
- [HNS-18](HNS-18.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R15, R16. Ver [PRD](../01-prd.md).

- [06-api-mcp.md](../06-api-mcp.md)
- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)

## Onde trabalhar

- `web/src/lib/sms/webhooks` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/workers` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/v1` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Validar URL/DNS/IP na configuração e em cada conexão, incluindo IPv6/rebinding.
2. Assinar body exato com timestamp e evento; cifrar secret e exibir uma vez.
3. Implementar 8 tentativas, timeout10s,410 disable, DLQ/status e replay de evento.
4. Enviar payload redigido, escopado por conta e tipo; sem corpo de SMS por padrão.

## Critérios de aceite

- [ ] Redirect não contorna bloqueio de rede interna.
- [ ] Duplicação at-least-once documentada e eventId estável.
- [ ] Replay webhook não cria mensagem nem tentativa SMS.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T37, T38, T40 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

