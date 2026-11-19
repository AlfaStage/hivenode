# Piloto com chip real

O piloto usa uma conta com acesso ao beta, um Android próprio com API 26 ou superior e um SIM físico ou eSIM ativo. Uma linha revisada por aparelho pode ter até cinco destinos brasileiros aprovados. Cada destino passa por revisão individual e cada chamada cria um único SMS. A fila aceita até cinco solicitações por conta numa janela móvel de 24 horas e o Android aceita até três partes por mensagem. Mantenha a tela SMS Beta aberta e o SIM aprovado selecionado durante o teste.

## Homologação em dois celulares

1. No Android remetente, instale o APK HiveNode a partir do canal usado no piloto. Abra **SMS Beta**. Confirme o número da versão e o certificado do arquivo fornecido pelo responsável.
2. Em **SMS Beta** no painel, selecione **Gerar código de vínculo**. Use **Ler QR do painel** no APK ou cole o código. O código vence em cinco minutos e funciona uma vez.
3. No app, toque em **Permitir acesso ao chip e SMS** e escolha o SIM. Se houver dois chips, confirme no painel que apenas o escolhido aparece como selecionado. Use **Pausar envios** para interromper a sessão.
4. No painel, informe em formato internacional o número autorizado e solicite a revisão. A pessoa administradora confere a autorização do destinatário e se o plano da operadora permite o uso. A primeira revisão aprova o chip e o número. Em **Aparelho e chip → Destinos aprovados → Adicionar número**, solicite revisão dos próximos números, um por vez. **Aprovar número** mantém os destinos anteriores ativos. Liberar acesso em **Administração → Usuários** apenas admite a conta no beta.
5. Com o app aberto no remetente, enfileire uma mensagem com um texto identificável, como `HiveNode teste 01`. Guarde o ID do envio. Confira no segundo celular o horário, texto e a linha remetente. Registre o resultado com telefones mascarados.
6. No painel, confirme **Enviado pelo Android** após a resposta de envio. **Entrega confirmada** exige recibo válido da rede. Se a mensagem chegou ao segundo celular e a rede não forneceu recibo, registre a observação de recebimento separadamente. Em **Resultado desconhecido**, confira o aparelho e o recebimento antes de criar outro envio.
7. Antes de usar uma lista real, teste a recusa de um número ainda em revisão, a pausa do app e a revogação de um destino. A revogação cancela os itens desse número que ainda estão na fila. O histórico preserva os estados de tentativas que já saíram da fila.

Em troca de SIM, alteração do inventário ou reinício do processo do app, o piloto gera novos identificadores. Volte ao painel e faça nova revisão da linha. A seleção nunca troca para outro SIM automaticamente. Usar modo avião, linhas bloqueadas ou planos inelegíveis não é um teste de entrega.

## API e operação

- `GET /api/sms/pilot` devolve o identificador do aparelho em `data.devices[0].id` e a lista `approvedDestinations` com os destinos mascarados.
- `POST /api/sms/pilot/messages` recebe `deviceId`, `destination` e `text`. Use `+55`, DDD e número sem separadores. O texto aceita até 420 caracteres e continua sujeito ao limite de três partes do Android.
- `GET /api/sms/pilot/messages?id=UUID` consulta uma mensagem. Sem o parâmetro, lista até 50 registros.
- `PATCH /api/sms/pilot/messages` recebe `{"id":"UUID","action":"cancel"}` e só cancela itens na fila.
- A chave do painel é enviada em `Authorization: Bearer ...`. Cada chave se limita à conta emissora. A troca revoga a anterior. O app usa uma credencial diferente, válida apenas para a rota do agente.
- Para conectar um cliente MCP local, execute `npx tsx scripts/sms-mcp.ts` a partir de `web` usando transporte stdio e injete `HIVENODE_SMS_API_KEY` pelo gerenciador de segredos do cliente. O servidor também aceita `HIVENODE_SMS_URL` como origem opcional. As ferramentas consultam aparelhos e mensagens, enfileiram com confirmação e cancelam itens pendentes pela mesma API.
- A flag `SMS_REAL_SEND_ENABLED` inicia desligada. Defina `SMS_PILOT_LOOKUP_KEY` com 32 bytes aleatórios em hexadecimal como segredo do ambiente. A flag ativa o piloto, e cada envio ainda exige liberação individual, chip e destino revisados. Desligar a flag impede novas autorizações; uma autorização já emitida vale por até 30 segundos.
- Fila expira em dez minutos. Autorização sem resposta fica desconhecida após a tolerância. Não há reenvio automático de tentativa que possa ter chegado ao modem. A caixa de saída nativa registra resultados antes de sincronizar, sem guardar corpo ou número.

### Exemplo de chamada

```http
POST https://hivenode.alfastage.com.br/api/sms/pilot/messages
Authorization: Bearer <CHAVE_SMS_DA_CONTA>
Content-Type: application/json
Idempotency-Key: 410db6fe-a37f-4ecf-b595-55c7b19f6434

{
  "deviceId": "11111111-1111-4111-8111-111111111111",
  "destination": "+5562999999999",
  "text": "Teste autorizado HiveNode SMS."
}
```

Troque o UUID do aparelho e o número de exemplo por dados reais de um destino aprovado no painel. Para uma lista, faça uma chamada por número com uma chave de idempotência diferente para cada SMS. Use 16 a 128 caracteres de `A–Z`, `a–z`, `0–9`, hífen ou sublinhado. Se a resposta falhar por queda de conexão, repita a mesma chamada com a mesma chave. O servidor devolve a mensagem original com `200`. Reutilizar a chave com outro destino ou texto gera `409`.

| Retorno | Significado |
| --- | --- |
| `202` | Aceito na fila. Guarde `data.message.id` e consulte o andamento. |
| `403` | Destino ausente da lista de aprovados para o chip. |
| `409` | SIM sem autorização ativa no app ou conflito da chave de idempotência. |
| `429` | A conta atingiu cinco solicitações em 24 horas. |

`SENT` indica envio reportado pelo Android. `DELIVERED` exige confirmação de entrega. A integração automatizada valida o protocolo sem usar rede móvel. A homologação do envio físico exige o teste no aparelho. Cobrança, equipes, um endpoint para lotes, agenda, webhooks, MCP remoto e Android Light seguem o [plano de entrega](12-entrega-operacao.md).
