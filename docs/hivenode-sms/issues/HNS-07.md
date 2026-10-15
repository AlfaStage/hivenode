# HNS-07 — Criar convites, gerenciamento de membros e transferência de OWNER

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-06](HNS-06.md) concluída e contratos revisados.
- [HNS-08](HNS-08.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R02, R03, R17. Ver [PRD](../01-prd.md).

- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)
- [02-negocio-cobranca.md](../02-negocio-cobranca.md)

## Onde trabalhar

- `web/src/app/api/v1` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/lib/workspaces` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Implementar list/invite/accept/revoke/role/grants/removal/owner-transfer conforme contrato.
2. Reservar vagas por 72h sob lock, normalizar email e armazenar só hash do convite.
3. Exigir email verificado, consumir convite uma vez e impedir escalada de grants pelo admin delegado.
4. Remoção mantém recursos e revoga acesso/keys; transferência reautentica e conserva billing contact.

## Critérios de aceite

- [ ] Concorrência na última vaga libera um único convite.
- [ ] OWNER nunca é removido por downgrade ou DELETE simples.
- [ ] Pessoa em outra conta conserva sessão daquela conta.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T05, T06, T07, T08 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

