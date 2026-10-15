# HNS-15 — Implementar serviço de mensagens, validação e idempotência

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-10](HNS-10.md) concluída e contratos revisados.
- [HNS-11](HNS-11.md) concluída e contratos revisados.
- [HNS-13](HNS-13.md) concluída e contratos revisados.
- [HNS-14](HNS-14.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R06, R07, R08, R13, R17. Ver [PRD](../01-prd.md).

- [06-api-mcp.md](../06-api-mcp.md)
- [07-fila-protocolo.md](../07-fila-protocolo.md)

## Onde trabalhar

- `web/src/lib/sms/service` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/v1` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/prisma/schema.prisma` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Validar corpo estrito, finalidade, E.164, conta/aparelho/linha e agenda.
2. Inserir mensagem+idempotência+outbox+audit atomicamente; lookup de key antes de defaults now.
3. Resolver corrida de unique e fingerprint igual/diferente; janela tombstone180d.
4. Criar list/get/cancel/resend conforme estados e escopos; resend novo ID com confirmação.

## Critérios de aceite

- [ ] POST repetido não cria outra intenção.
- [ ] 409 para corpo diferente; ID de outra conta 404.
- [ ] Cancelar AUTHORIZED não promete recall; body só aparece com grant de conteúdo.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T15, T16, T17, T19, T54 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

