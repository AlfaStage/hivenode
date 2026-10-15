# Painel, aplicativos e jornadas

## Navegação e conta

Manter dashboard único com seletor de conta e entradas Serviços → Proxy / SMS, Equipe, Integrações e Cobrança. Não criar login SMS separado. Se usuário estiver em várias contas, mostrar nome/identidade da conta em cada tela e confirmação de ação; troca cancela queries/tickets antigos e limpa caches específicos.

Menu por permissão ajuda uso, mas cada endpoint continua protegido. Usuário sem acesso a SMS vê somente oferta se puder contratar; operador não é enviado para checkout que não tem permissão. Suspenso pode acessar apenas ações permitidas, motivos e contato de suporte.

## Telas SMS

| Tela | Conteúdo e ações | Estados obrigatórios |
|---|---|---|
| Visão geral | Pendentes, enviados, entregues, desconhecidos, aparelhos e pausas | Sem plano, trial, fila parada, carregando, erro |
| Aparelhos/chips | Label, modelo, disponibilidade SMS, linhas, contrato e autorização | Sem permissão, SIM removido, número ausente, incompatível |
| Novo envio | Aparelho, linha, finalidade, destinatário, texto/modelo, agenda | Preview pendente, supressão, tamanho, política ausente |
| Confirmação de lote | Total de destinos, remetente, agenda, segmentos estimados | Itens inválidos, duplicados, cap de fila |
| Mensagens | Cursor, período, estado, linha, ator, diagnóstico | Corpo purgado, restrição de conteúdo, sem dados |
| Detalhe | Timeline, tentativas, segmentos, entrega e próximos passos | PARTIAL/UNKNOWN destacados; não usar falso sucesso |
| Modelos | Texto versionado, variáveis necessárias, finalidade | Variável ausente, template desativado |
| Descadastro | Supressões marketing e origem | Acesso negado, destinatário já bloqueado |
| Integrações | Keys, scopes, aparelhos, MCP local, endpoints webhook | Chave revogada/expirada, erro SSRF, secret exibido uma vez |
| Equipe | Membros/grants, convites, vagas e origem da capacidade | Convite expirado, cap excedido, downgrade próximo |
| Cobrança | Serviços separados, quote, prazo pago, cancelamento | PENDING, falha, evento em conciliação |

## Fluxo de ativação

1. Mostrar requisitos e verificar compatibilidade. Contratação sem linha elegível não promete uso real.
2. Aceite específico de versão; declaração de titularidade/uso autorizado e condições da operadora.
3. Vincular aparelho à conta com login/pareamento autorizado; aparelho confirma conta e chips localmente.
4. Criar política de linha elegível com evidência/contrato válido. Se pendente, mostrar bloqueio e ação concreta.
5. Primeiro envio para número controlado, mostrar contador de segmentos e estados reais.

Limite de aparelhos é por serviço: na lista geral, badges Proxy/SMS. SMS desabilitado não apaga nó nem para proxy. Dois chips não dobram mensalidade nem capacidade contratual.

## Envio e importação

Normalizar destino E.164 com país explícito; não transformar número ambíguo em destino silenciosamente. CSV até 100 itens por lote no piloto, cabeçalhos documentados `clientItemId,to,text` ou template+variáveis; parse no servidor, negar fórmulas e não carregar anexos ilimitados. Preview devolve erros por linha; commit só quando lote inteiro válido.

Para marketing, inserir link individual de descadastro antes do preview final. Calcular segmentos finais com aparelho/encoding; estimativa no servidor é indicativa. Se app recalcular quantidade diferente, pedir grant com valor real e atualizar UI/trial; não modificar texto depois de grant.

Agendamento mostra timezone escolhido, hora local E instante UTC. Default de apresentação da conta nova: America/Sao_Paulo; usuário pode escolher outro fuso IANA. Testar transições DST em outro fuso e horários inexistentes/ambíguos com confirmação; não assumir que todo país segue São Paulo.

## Textos de interface recomendados

- QUEUED: “Na fila. O envio depende da disponibilidade do aparelho e da linha.”
- SENT: “Envio confirmado. Entrega ainda não confirmada.”
- DELIVERED: “Entrega confirmada pelo relatório disponível. Isso não confirma leitura.”
- UNKNOWN: “Não foi possível confirmar se o aparelho enviou. Reenviar pode duplicar a mensagem.”
- PARTIAL: “Parte da mensagem foi enviada. Acompanhe os segmentos antes de decidir reenviar.”
- Cancelamento após grant: “O envio já foi autorizado e pode estar em execução. Não é possível garantir o cancelamento.”
- SIM trocado: “A linha mudou. Revise o chip e autorize novamente antes de continuar.”

## Equipe

Convite mostra acesso SMS/proxy e aparelhos; evitar checkbox “administrador de tudo” preselecionado. Conteúdo SMS e senha proxy são grants separados. Não esconder regra de que proprietário conta na capacidade. Cadastro do funcionário não muda titularidade dos aparelhos para ele.

Ao downgrade, tela pede quais membros/aparelhos conservar e mostra efeito no outro serviço quando capacidade global cai. Se proxy fornecer benefício maior, reduzir SMS não suspende membros desnecessariamente. Recurso removido é suspenso, não apagado.

## Acessibilidade e QA

Labels reais, foco visível, navegação por teclado, status anunciados com aria-live moderado, cores acompanhadas por texto, tabelas responsivas e confirmação acessível. Números mascarados e corpo oculto por padrão onde possível. Não persistir conteúdo em localStorage. Botão de envio desabilita reentrada mas idempotência continua no servidor.

Testes Playwright devem percorrer pessoa SMS-only, proxy-only, OWNER, VIEWER e agência com duas contas; verificar rede/DOM sem vazamento da conta anterior. Não usar login de ADMIN global para provar uma jornada de cliente.
