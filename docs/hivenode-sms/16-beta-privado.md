# Beta privado do HiveNode SMS

O beta de SMS tem admissão separada do HiveMiner. Administradores têm acesso pela função administrativa. Para liberar uma conta de cliente, abrir **Administração → Usuários**, editar a conta e selecionar **Liberar SMS**. O mesmo local oferece **Revogar SMS**. A alteração fica na auditoria. Novas contas começam sem acesso.

O acesso é consultado no servidor. A página e a API verificam a sessão, e cada operação confirma a permissão de novo dentro da transação. Uma sessão de Proxy ou Miner não é válida no SMS. Revogação bloqueia novas operações, revoga a chave e o aparelho SMS do cliente e cancela os envios pendentes. Eventos de tentativa já iniciada ainda podem ser conciliados.

## Envio por chip

Participantes admitidos pareiam o app Android em **SMS Beta**, escolhem uma linha ativa no aparelho e solicitam a revisão de um destino de teste próprio. Administradores aprovam a linha depois de revisar a permissão da operadora. O envio usa `SmsManager` para aquela assinatura móvel. O servidor apaga o conteúdo cifrado quando emite a autorização e mantém registros mascarados por 30 dias. O painel permite cancelar enquanto a mensagem ainda está em fila.

O roteiro físico, a API do piloto e as responsabilidades de ativação estão em [Piloto com chip real](17-piloto-real.md).

## Aceite do beta com envio real

- HNS-13, HNS-17 e HNS-18 ligam pareamento, autorização física e conciliação à admissão do beta atual. Revogar conta ou linha bloqueia novo grant em todos os canais e mantém o relato de eventos já ocorridos.
- HNS-23, HNS-24 e HNS-32 entregam o executor no Android principal e a evidência no aparelho pelo canal planejado. A linha precisa ter autorização para o uso e o teste usa destino controlado.
- HNS-34 libera o beta assistido após esses aceites e os testes negativos de acesso. HNS-38 entrega o ciclo pago para participantes. Equipes, lotes, MCP, Light e marketing entram no beta conforme seus aceites próprios. A abertura externa é uma decisão separada.

## Verificação local

Aplicar `npm run db:migrate:deploy` ao PostgreSQL isolado conforme o [plano de testes](11-testes.md) e executar `npm run test:integration` em `web`. A integração verifica administrador, cliente comum, cliente autorizado, credenciais de chave e aparelho, aprovação de linha, isolamento, idempotência, concessão única de autorização, reconciliação, revogação e auditoria. A homologação de modem depende do APK instalado, do telefone e da linha real.

Com o Chromium do Playwright instalado, em `web`, executar `npx tsx scripts/browser-integration.ts --sms-beta-only` para verificar liberação, código de vínculo e revogação no navegador.
