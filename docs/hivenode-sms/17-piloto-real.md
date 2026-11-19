# Piloto com chip real

O piloto usa a conta do beta, um Android próprio com API 26 ou superior, um SIM físico ou eSIM ativo e um destino brasileiro de teste sob controle do participante. O executor funciona enquanto a tela SMS do app estiver em uso. O painel e a API permitem uma linha e um destino revistos por aparelho. A fila aceita até cinco mensagens por conta a cada 24 horas e o Android aceita até três partes por mensagem neste piloto.

## Homologação em dois celulares

1. No Android remetente, instale o APK HiveNode a partir do canal usado no piloto. Abra **SMS Beta**. Confirme o número da versão e o certificado do arquivo fornecido pelo responsável.
2. Em **SMS Beta** no painel, selecione **Gerar código de vínculo**. Use **Ler QR do painel** no APK ou cole o código. O código vence em cinco minutos e funciona uma vez.
3. No app, toque em **Permitir acesso ao chip e SMS** e escolha o SIM. Se houver dois chips, confirme no painel que apenas o escolhido aparece como selecionado. Use **Pausar envios** para interromper a sessão.
4. No painel, informe em formato internacional o número do segundo celular, que precisa estar sob seu controle, e solicite a revisão. A pessoa administradora deve conferir que o plano da operadora permite o envio pretendido antes de aprovar a linha. Liberar acesso ao beta em **Administração → Usuários** só concede acesso ao painel.
5. Com o app aberto no remetente, enfileire uma mensagem com um texto identificável, como `HiveNode teste 01`. Guarde o ID do envio. Confira no segundo celular o horário, texto e a linha remetente. Registre o resultado com telefones mascarados.
6. No painel, confirme **Enviado pelo Android** após a resposta de envio. **Entrega confirmada** exige recibo válido da rede. Se a mensagem chegou ao segundo celular e a rede não forneceu recibo, registre a observação de recebimento separadamente. Em **Resultado desconhecido**, confira o aparelho e o recebimento antes de criar outro envio.
7. Para validar fail-closed, pause o app e verifique que a fila não dispara. Revogue o acesso em uma conta controlada e verifique o bloqueio da próxima operação. Faça os testes de falha antes de liberar outros participantes.

Em troca de SIM, alteração do inventário ou reinício do processo do app, o piloto gera novos identificadores. Volte ao painel e faça nova revisão da linha. A seleção nunca troca para outro SIM automaticamente. Usar modo avião, linhas bloqueadas ou planos inelegíveis não é um teste de entrega.

## API e operação

- `GET /api/sms/pilot` lista o próprio aparelho e as linhas observadas.
- `POST /api/sms/pilot/messages` recebe `deviceId`, `destination` e `text`. Passe `Idempotency-Key` entre 16 e 128 caracteres. Retorno 202 significa que o banco aceitou a solicitação para fila; não representa resposta da operadora.
- `GET /api/sms/pilot/messages?id=UUID` consulta uma mensagem. Sem o parâmetro, lista até 50 registros.
- `PATCH /api/sms/pilot/messages` recebe `{"id":"UUID","action":"cancel"}` e só cancela itens na fila.
- A chave do painel é enviada em `Authorization: Bearer ...`. Cada chave se limita à conta emissora. A troca revoga a anterior. O app usa uma credencial diferente, válida apenas para a rota do agente.
- Para conectar um cliente MCP local, execute `npx tsx scripts/sms-mcp.ts` a partir de `web` usando transporte stdio e injete `HIVENODE_SMS_API_KEY` pelo gerenciador de segredos do cliente. O servidor também aceita `HIVENODE_SMS_URL` como origem opcional. As ferramentas consultam aparelhos e mensagens, enfileiram com confirmação e cancelam itens pendentes pela mesma API.
- A flag `SMS_REAL_SEND_ENABLED` inicia desligada. Defina `SMS_PILOT_LOOKUP_KEY` com 32 bytes aleatórios em hexadecimal como segredo do ambiente. A flag ativa o piloto, e cada envio ainda exige liberação individual, chip e destino revisados. Desligar a flag impede novas autorizações; uma autorização já emitida vale por até 30 segundos.
- Fila expira em dez minutos. Autorização sem resposta fica desconhecida após a tolerância. Não há reenvio automático de tentativa que possa ter chegado ao modem. A caixa de saída nativa registra resultados antes de sincronizar, sem guardar corpo ou número.

O diagnóstico automático trata respostas do Android e da operadora como evidências separadas. A integração automatizada valida o protocolo sem usar rede móvel. A homologação do envio físico exige o teste acima. Cobrança, equipes, lotes e agenda, webhooks, MCP remoto e Android Light seguem os aceites separados do [plano de entrega](12-entrega-operacao.md).
