# HNS-01 — Validar contratos do produto, preços e gates de lançamento

Prioridade: P0 • Situação: TODO • Responsável sugerido: Produto/comercial com revisão jurídica; junior organiza evidências

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- Sem dependência de código novo; usar a baseline documental e preservar alterações existentes.

## Requisitos e leitura obrigatória

Requisitos: R04, R06, R17, R21. Ver [PRD](../01-prd.md).

- [02-negocio-cobranca.md](../02-negocio-cobranca.md)
- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)
- [13-decisoes-fontes.md](../13-decisoes-fontes.md)

## Onde trabalhar

- `docs/hivenode-sms` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/admin/plans/route.ts` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Revisar baseline 1990/4990/9990 centavos e diferenciar benefício global de membros de aparelhos por serviço.
2. Identificar responsável jurídico/comercial; registrar como a elegibilidade de linha é comprovada sem tratar checkbox como autorização.
3. Definir custos de suporte/infra e limites públicos do piloto; confirmar ausência de cobrança por mensagem.
4. Criar ADR para qualquer mudança de escopo, catálogo ou benefício proxy; não publicar preços ainda.

## Critérios de aceite

- [ ] Baseline e pendências têm dono, saída e gate; sem promessa de aprovação jurídica ou envio ilimitado da operadora.
- [ ] Valores são snapshots por período; plano proxy antigo conserva benefício 1 até revisão.
- [ ] Nada foi publicado nem cobrado nesta issue.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T19, T46, T52 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

