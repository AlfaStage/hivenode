# HNS-17 — Implementar API de aparelho, lease e grants assinados

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend/security; revisão obrigatória

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-13](HNS-13.md) concluída e contratos revisados.
- [HNS-15](HNS-15.md) concluída e contratos revisados.
- [HNS-16](HNS-16.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R06, R07, R10, R13, R18. Ver [PRD](../01-prd.md).

- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)
- [07-fila-protocolo.md](../07-fila-protocolo.md)
- [06-api-mcp.md](../06-api-mcp.md)

## Onde trabalhar

- `web/src/lib/sms/device` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/device/v1` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Implementar HMAC de request com método/path/body/nonce/timestamp e replay cache.
2. Claim pinned por node/epoch/SIM/version com lease120s e uma execução por aparelho.
3. Grant assimétrico30s, body/recipient fingerprints, segmentos/reserva trial e fencing persistido.
4. Revalidar membership/key/entitlement/política/supressão/expiry no grant; recuperar mesma autorização se resposta perder.

## Critérios de aceite

- [ ] Nó não pede tentativa/grant de outro nó.
- [ ] Lease vencido após grant gera UNKNOWN, não redispatch.
- [ ] Kill switch e DB indisponível impedem novo grant; evento final continua aceito.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T20, T21, T23, T41, T54 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

