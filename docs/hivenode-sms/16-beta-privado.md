# Beta privado do HiveNode SMS

O beta de SMS tem admissão separada do HiveMiner. Administradores têm acesso pela função administrativa. Para liberar uma conta de cliente, abrir **Administração → Usuários**, editar a conta e selecionar **Liberar SMS**. O mesmo local oferece **Revogar SMS**. A alteração fica na auditoria. Novas contas começam sem acesso.

O acesso é consultado no servidor. A página e a API verificam a sessão, e cada operação da API confirma a permissão de novo dentro da transação. Uma sessão de aparelho não pode usar a interface de pessoa. Revogação bloqueia a próxima operação mesmo com sessão aberta e cancela simulações em fila da conta. O histórico pertence à conta que criou cada teste, inclusive para administradores que usem o beta.

## Primeiro fluxo disponível no código

Após aplicar a migração, pessoas admitidas têm **SMS Beta** no painel. O ambiente usa uma fila persistente de simulações. É possível criar um teste com número fictício, cancelar o pendente ou simular entrega, envio sem recibo, falha ou resultado desconhecido. O servidor guarda destino mascarado e fingerprint do pedido. O texto de teste não é armazenado. O histórico de simulação é limitado aos últimos 30 dias e 50 registros por consulta. O worker faz a remoção dos dados vencidos.

API de simulação `/api/sms/beta/messages`.

| Método | Operação |
|---|---|
| GET | Lista o histórico da própria conta |
| POST | Cria teste com `destination`, `text` e `scenario`. Requer `Idempotency-Key` entre 16 e 128 caracteres |
| PATCH | Recebe `id` e `action` igual a `simulate` ou `cancel` |

`scenario` aceita `DELIVERED`, `SENT`, `FAILED` e `UNKNOWN`. A API aceita sessão web ou bearer da mesma sessão. Rotas mutáveis em navegador conferem `Origin` com `NEXT_PUBLIC_APP_URL`. Status 401 indica ausência de sessão, 404 cobre conta sem beta ou recurso fora dela e 409 cobre conflito de chave ou estado. O caminho de simulação é separado dos contratos planejados de envio real.

## Aceite do beta com envio real

- HNS-13, HNS-17 e HNS-18 ligam pareamento, autorização física e conciliação à admissão do beta atual. Revogar conta ou linha bloqueia novo grant em todos os canais e mantém o relato de eventos já ocorridos.
- HNS-23, HNS-24 e HNS-32 entregam o executor no Android principal e a evidência no aparelho pelo canal planejado. A linha precisa ter autorização para o uso e o teste usa destino controlado.
- HNS-34 libera o beta assistido após esses aceites e os testes negativos de acesso. HNS-38 entrega o ciclo pago para participantes. Equipes, lotes, MCP, Light e marketing entram no beta conforme seus aceites próprios. A abertura externa é uma decisão separada.

## Verificação local

Aplicar `npm run db:migrate:deploy` ao PostgreSQL isolado conforme o [plano de testes](11-testes.md) e executar `npm run test:integration` em `web`. A integração verifica administrador, cliente comum, cliente autorizado, token de aparelho, isolamento, idempotência, revogação na sessão existente e auditoria. A homologação de modem continua dependendo de APK, telefone e linha reais.

Com o Chromium do Playwright instalado, em `web`, executar `npx tsx scripts/browser-integration.ts --sms-beta-only` para verificar liberação, simulação e revogação no navegador.
