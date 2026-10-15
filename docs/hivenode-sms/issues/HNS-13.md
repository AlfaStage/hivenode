# HNS-13 — Criar termos versionados, inventário SIM e política elegível

Prioridade: P0 • Situação: TODO • Responsável sugerido: Backend/mobile com compliance

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-02](HNS-02.md) concluída e contratos revisados.
- [HNS-06](HNS-06.md) concluída e contratos revisados.
- [HNS-11](HNS-11.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R05, R06, R17. Ver [PRD](../01-prd.md).

- [08-android.md](../08-android.md)
- [10-seguranca-conformidade.md](../10-seguranca-conformidade.md)

## Onde trabalhar

- `web/src/lib/sms/policies` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/device/v1` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `web/src/app/api/v1` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Gravar aceites por pessoa/conta/document hash sem exoneração total.
2. Receber capabilities/inventory autenticados e validar node/epoch/subscription/binding.
3. Versionar SimPolicy por finalidade/limites/roaming/evidência; checkbox não aprova contrato.
4. Invalidar bindings removidos/incertos e bloquear execução, sem trocar SIM automaticamente.

## Critérios de aceite

- [ ] Inventário só contém linhas ativas acessíveis; número ausente é permitido.
- [ ] Troca no mesmo slot pausa pendentes.
- [ ] Sem confirmação local/linha elegível não existe grant.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T19, T30, T45, T51 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

