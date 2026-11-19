# Gateway SMS no Android

O gateway usa o plano móvel do próprio cliente. A API aceita um destinatário por chamada, sem cota diária de envios do HiveNode no modo gateway. Cada Android processa um SMS por vez. O limite de três partes por mensagem, as condições do plano, a rede móvel e as restrições do Android continuam aplicáveis.

## Ativação

1. Atualize o HiveNode Android para 1.1.6 ou superior e abra **SMS Beta** em uma conta liberada.
2. Use o vínculo existente ou gere um código no painel. Toque em **Ativar gateway**, confirme que a operadora permite o uso e conceda as permissões de SMS e telefone.
3. Confirme no painel que o Android está conectado. Selecione o chip no campo **Chip remetente**. O painel mostra o número da linha quando o Android consegue fornecê-lo. Nos outros casos, use o slot e a operadora para identificar o chip.
4. Deixe o Android ligado e conectado. Após ativar o serviço, a tela do HiveNode pode ficar fechada. O Android mostra o serviço ativo e oferece pausa. Se o sistema interromper o gateway ou se você forçar a parada do app, abra o HiveNode e reative o serviço.

Ativar o gateway cancela mensagens ainda na fila do modo legado. O vínculo, a chave da API e o histórico continuam disponíveis. O identificador do chip se mantém durante reinicializações normais enquanto o Android identifica a mesma assinatura no mesmo vínculo. Se o chip removido retornar com outra assinatura, consulte o novo identificador no painel. [Execução de serviços no Android](https://developer.android.com/develop/background-work/services/fgs/launch) · [Número da assinatura móvel](https://developer.android.com/reference/android/telephony/SubscriptionManager#getPhoneNumber(int))

## API e MCP

Envie `Authorization: Bearer <CHAVE_SMS>` nas chamadas. `GET /api/sms/pilot` devolve os chips em `data.sims`, incluindo `simId`, `phoneNumber`, `carrier`, `slot`, `deviceLabel`, `enabled` e `online`. `slot` começa em zero e o painel numera a partir de um.

```http
POST https://hivenode.alfastage.com.br/api/sms/pilot/messages
Authorization: Bearer <CHAVE_SMS>
Content-Type: application/json
Idempotency-Key: 410db6fe-a37f-4ecf-b595-55c7b19f6434

{
  "simId": "11111111-1111-4111-8111-111111111111",
  "destination": "+5562999999999",
  "text": "Teste autorizado HiveNode SMS. Responda SAIR para parar de receber.",
  "consentConfirmed": true
}
```

Use o número autorizado com `+55`, DDD e número sem separadores. Envie uma chave de idempotência diferente para cada SMS. Repita uma requisição interrompida com a mesma chave e os mesmos dados. A resposta `202` fornece o identificador em `data.message.id`. Consulte-o em `GET /api/sms/pilot/messages?id=<ID>`. Um descadastro retorna `403`. Chip pausado ou indisponível retorna `409`. Se a conexão cair com o gateway habilitado, a fila aguarda o retorno do chip por até 24 horas.

No MCP, use `listar_aparelhos_sms`, `enfileirar_sms` com `simId`, `consentConfirmed: true` e `confirmed: true`, e `consultar_sms` para acompanhar cada envio. `listar_contatos_sms` consulta os mesmos dados da REST.

## Contatos e descadastro

- `GET /api/sms/pilot/contacts?simId=<ID_DO_CHIP>` lista os contatos com envio reportado pelo Android nesse chip.
- `GET /api/sms/pilot/contacts?optedOut=true` lista os descadastros de todos os chips da conta. Use `after=<nextCursor>` para consultar as páginas seguintes.
- O Android identifica comandos como `SAIR`, `#sair`, `NÃO RECEBER`, `STOP`, `PARE` e `CANCELAR`. Somente o número do remetente e o código do comando são sincronizados. O texto recebido fica no Android e o servidor aplica o bloqueio aos contatos conhecidos da conta.
- Ao sincronizar o descadastro, o servidor bloqueia novas solicitações por qualquer chip e cancela os SMS daquele número que ainda estejam na fila. Uma autorização já entregue ao Android pode estar em execução. O app também verifica descadastros locais antes da chamada ao modem.
- O usuário confirma o consentimento no formulário ou em `consentConfirmed`. Uma confirmação posterior de envio não remove um descadastro.

## Teste com aparelhos reais

Use dois celulares e números autorizados. Escolha o SIM pelo painel, minimize o app remetente, bloqueie a tela e enfileire uma mensagem. Confirme a linha remetente no outro celular. Responda `#sair` e aguarde o número aparecer em **Contatos SMS → Descadastros da conta**. Tente enfileirar outra mensagem para ele por um chip diferente e confira o bloqueio. Teste também fechar a tela, perder a rede, pausar pelo Android e reativar. Registre a versão do Android, a operadora e o resultado com números mascarados.
