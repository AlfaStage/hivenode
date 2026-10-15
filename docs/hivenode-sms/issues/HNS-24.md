# HNS-24 — Integrar agente e telas SMS no app principal

Prioridade: P0 • Situação: TODO • Responsável sugerido: Mobile

## Contexto e objetivo

Implementar esta parte do HiveNode SMS/equipes conforme as especificações vinculadas. Este arquivo é uma issue local pronta para importar; não foi publicado em tracker externo. Não confundir TODO com funcionalidade existente.

## Dependências

- [HNS-23](HNS-23.md) concluída e contratos revisados.
- [HNS-06](HNS-06.md) concluída e contratos revisados.
- [HNS-13](HNS-13.md) concluída e contratos revisados.

## Requisitos e leitura obrigatória

Requisitos: R05, R06, R12, R18. Ver [PRD](../01-prd.md).

- [08-android.md](../08-android.md)
- [09-painel-jornadas.md](../09-painel-jornadas.md)

## Onde trabalhar

- `hivenode-app/src/app/index.tsx` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-app/src/app/_layout.tsx` (conferir existência; caminhos de módulos novos são alvos A CRIAR).
- `hivenode-app/plugins` (conferir existência; caminhos de módulos novos são alvos A CRIAR).

## Passos de implementação

1. Extrair integração SMS em módulos sem ampliar monólito de index.tsx.
2. Mostrar conta/chips/custos/autorizações; ativar permissões apenas ao habilitar serviço.
3. Agente HTTPS claim/grant/events com persistência nativa e reconciliação.
4. Tratar timeout FGS/background/reboot/logout/force-stop e badges distintos de proxy/SMS.

## Critérios de aceite

- [ ] SMS funciona sem assinatura proxy e sem sessão de túnel.
- [ ] Revogação local pausa envio e mantém diagnóstico.
- [ ] App build/bridge validado; rede real aguarda proprietário.
- [ ] Evidências e limitações anexadas ao PR; revisão das áreas críticas feita pelo responsável.

## Testes e evidências

Executar T19, T30, T32, T49, T50 conforme [plano de testes](../11-testes.md). Para cada caso registrar ambiente, commit/build, entrada, esperado/observado e status. Caso físico ou comercial não disponível fica BLOQUEADO/NAO_EXECUTADO com responsável, nunca PASSOU.

## Como revisar e entregar

PR pequeno com problema/resultado, critérios de aceite e testes relevantes. Não copiar secrets, contatos reais ou corpo de SMS para logs. Para billing/migração/auth/modem, solicitar revisão experiente. Feature flag desligada e compatibilidade preservada quando gate posterior não estiver concluído. Atualizar o estado desta issue e a matriz de rastreabilidade após revisão.

