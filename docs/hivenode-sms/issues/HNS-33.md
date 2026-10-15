# HNS-33 — Validar jurídico, custos, gateway real e distribuição

Prioridade: P0 • Situação: TODO • Responsável sugerido: Produto/jurídico/financeiro

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-01](HNS-01.md) concluída e contratos revisados.
- [HNS-02](HNS-02.md) concluída e contratos revisados.
- [HNS-12](HNS-12.md) concluída e contratos revisados.
- [HNS-29](HNS-29.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R04, R06, R16, R17, R21. Ver [PRD](../01-prd.md).

- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)
- [13-decisoes-fontes.md](../13-decisoes-fontes.md)

## Onde trabalhar

- `docs/hivenode-sms` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/admin/plans` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Obter revisão de termos/privacidade/tratamento/uso e enquadramento por responsável.
2. Validar contrato/linha para piloto e documentação pública de limites/suporte.
3. Executar pagamento/cancelamento real controlado autorizado e canal de distribuição.
4. Confirmar custos e preços sustentáveis; não executar comunicações externas sem autorização do responsável.

## Critérios de aceite

- [ ] Responsabilidade do cliente não é exoneração total.
- [ ] Sem linha elegível/gateway/distribuição liberados, release real bloqueado.
- [ ] Valores e pendências atualizados com decisão rastreável.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T14, T19, T40, T52 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

