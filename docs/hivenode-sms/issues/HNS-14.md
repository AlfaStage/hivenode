# HNS-14 — Implementar descadastro marketing e evidências de finalidade

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend/web

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-06](HNS-06.md) concluída e contratos revisados.
- [HNS-13](HNS-13.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R06, R16, R17. Ver [PRD](../01-prd.md).

- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)
- [09-painel-jornadas.md](../09-painel-jornadas.md)

## Onde trabalhar

- `web/src/lib/sms/policies` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/v1/sms/optout` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/sms/optout` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Criar supressão por conta+hash de destino e token opaco de descadastro.
2. GET mostra confirmação; POST bloqueia marketing idempotentemente sem login.
3. Inserir link antes do preview final e revalidar supressão no grant.
4. Registrar origem/adesão/reinscrição; CSV não limpa supressão; não pedir READ_SMS na v1.

## Critérios de aceite

- [ ] Descadastro bloqueia todos os chips/aparelhos da conta em marketing.
- [ ] Scanner GET não descadastra involuntariamente.
- [ ] Supressão não exige identidade/chave de envio nem expõe telefone em URL.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T18, T19, T40, T51 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

