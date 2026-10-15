# Equipes, credenciais e autorização

## Contexto obrigatório

Toda operação resolve `actor → workspace → membership ACTIVE → permissão → recurso → entitlement → política`. O workspaceId da URL é alvo a verificar, não prova de acesso. Consultar recursos por ID E workspaceId; nunca buscar pelo ID e confiar em frontend para filtrar.

API key fixa uma conta, possui criador, recursos permitidos e escopos. Permissão efetiva é interseção entre escopo da chave, grants vigentes do criador, conta e assinatura. Remoção/suspensão do criador revoga execução das chaves criadas por ele; transferência deliberada para credencial de serviço exige ação do OWNER e auditoria. Não criar conta de serviço com login compartilhado para contornar vagas humanas.

## Papéis

| Ação | OWNER | ADMINISTRATOR | OPERATOR | VIEWER |
|---|---|---|---|---|
| Assinatura/cancelamento | Sim | Não | Não | Não |
| Transferir proprietário | Sim, reautenticação | Não | Não | Não |
| Convidar/remover membros | Sim | Só grants delegados, sem OWNER | Não | Não |
| Vincular/desabilitar aparelho | Sim | Só `devices:manage` | Só grant explícito | Não |
| Enviar/cancelar SMS pendente | Sim se elegível | Se grant SMS | Se grant SMS | Não |
| Ler histórico SMS | Sim | Se grant | Se grant | Se grant |
| Ler conteúdo SMS | Grant separado | Grant separado | Grant separado | Grant separado |
| Criar/rotacionar proxy | Sim se elegível | Se grant proxy | Se grant proxy | Não |
| Ver senha proxy | Grant separado | Grant separado | Grant separado | Não |
| Criar chave API | Sim | Se grant e dentro do próprio escopo | Se grant e dentro do próprio escopo | Não |

OWNER tem capacidade de administrar grants da própria conta, mas não contorna suspensão, descadastro ou política de linha. ADMIN global da plataforma não é OWNER implícito de qualquer conta. Suporte administrativo usa grant temporário auditado para metadata necessária, sem executar SMS nem expor corpo/segredo por padrão.

## Catálogo de permissões

`team:read`, `team:manage`, `billing:read`, `billing:manage`, `devices:read`, `devices:manage`, `sms:read`, `sms:content:read`, `sms:send`, `sms:cancel`, `sms:pause`, `sms:export`, `sms:policy:manage`, `sms:webhooks:manage`, `sms:suppressions:manage`, `proxy:read`, `proxy:manage`, `proxy:secret:read`, `keys:manage`.

`team:manage` nunca permite criar grants que o administrador não possui/delega. SMS send exige sms:send + node autorizado + SIM autorizado nesse node. `sms:export` não implica leitura do corpo. VIEWER não recebe envio por ferramenta MCP. Grants wildcard de aparelho são explícitos, não inferidos de array vazio.

## Convite e troca de conta

1. OWNER/admin autorizado informa email, papel e grants; servidor normaliza email sem modificar arbitrariamente regras do provedor.
2. Transação trava conta, confere capacity incluindo convites, gera token aleatório e grava hash/expiração 72h.
3. Enviar convite por fluxo de email existente, sem colocar credenciais. Falha de email permite reenvio sem consumir outra vaga.
4. Aceite exige login com email verificado correspondente, token válido, conta elegível e vaga reservada; consumir uma vez atomicamente.
5. Trocar workspace na UI limpa caches/dados anteriores. Cada fetch/ticket/WS indica contexto verificado pelo servidor.

Remover membro incrementa authorizationVersion da conta, invalida caches/grants e sessões de serviço daquele vínculo. Pessoa pode continuar logada em outras contas. Transferir OWNER exige destino ACTIVE, reautenticação e uma transação; manter audit trail e contato de cobrança definido.

## Autorização distribuída

Caches positivos de grants humanos: TTL máximo 30s com invalidação por versão; caches de grant físico SMS não substituem verificação no banco. Ticket de dashboard de uso único inclui workspaceId, actor, resources, authorizationVersion e prazo. Broker verifica o ticket e filtra cada evento/objeto; não transmitir tudo para a UI filtrar.

Conta suspensa, membro revogado, credencial revogada, SIM trocado ou entitlement vencido invalidam novas execuções. Nó precisa continuar reportando eventos de tentativas anteriores por credencial de dispositivo dedicada, sem permissão de enviar.

## Dispositivo

Identidade por instalação: nodeId, workspaceId, installationEpoch e chave de instalação armazenada com proteção do SO; servidor cifra chave usando gestão própria e rota explicitamente autenticada. Registro requer permissão devices:manage e confirmação do aparelho. Nunca reutilizar token humano de 7 dias como licença perpétua do modem.

Envelope autenticado HTTPS de aparelho: headers `X-Hive-Node`, `X-Hive-Epoch`, `X-Hive-Timestamp`, `X-Hive-Nonce`, `X-Hive-Signature`. HMAC-SHA256 cobre método, path+query canônica, timestamp, nonce e SHA256 dos bytes exatos do body separados por newline. Timestamp em segundos, tolerância 90s; nonce aleatório único com replay-cache 180s; comparação constante. Assinatura/body não entram em logs. Agente renova nonce em retry e preserva ID de evento para dedup. Sessão de proxy e credencial SMS são isoladas por finalidade.

## Casos obrigatórios

- Mesmo usuário em contas A/B não usa chave A para enviar por nó B.
- Convite A não é aceito por email B; token repetido/expirado não funciona.
- Dois convites simultâneos para última vaga: um único sucesso.
- Membro SMS-only não cria proxy nem recebe evento proxy.
- NodeShare aceito não aparece na seleção SMS da conta beneficiária.
- ADMIN global sem grant não lê conteúdo nem executa mensagem.
- Membro removido durante fila não obtém grant; mensagem fica SUSPENDED com motivo e precisa de reatribuição/revisão por membro autorizado.
- Reduzir seats suspende excedentes conforme regra comercial e mantém um OWNER.
- Proxy público e consumo GB preservam beneficiário pagante, sem contar SMS como bytes vendidos.
