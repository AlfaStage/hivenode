# Auditoria técnica do HiveNode — 09/09/2026

## Escopo e conclusão

Revisão do código local da Web/API, broker Go, HiveNode Android, HiveMiner Android, HiveNode Light, HiveDocker, CLI e configuração de implantação. Inclui alterações locais que ainda não estão commitadas; não comprova qual versão está publicada.

**Conclusão:** há bloqueadores de segurança, isolamento entre clientes, integração dos apps e cobrança. Priorizar estabilização do fluxo completo antes de ampliar a operação comercial.

O Coolify e os dois endpoints públicos de saúde não puderam ser acessados pelas ferramentas. Isso não comprova indisponibilidade da produção. Não houve teste em dispositivo Android, compra real, teste de carga nem execução de endpoints destrutivos. Nenhum código da aplicação foi alterado nesta revisão.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| Web: `npm test` | 13 testes passaram, em 3 arquivos. |
| Web: `npx --no-install tsc --noEmit --incremental false` | Falhou: relações Prisma inexistentes, categorias inválidas, parâmetros de rota, componentes administrativos e tipos Redis/BullMQ. |
| Web: `npm run lint` | Reportou 42 erros e 43 warnings; a execução terminou por timeout de 120 segundos depois de imprimir o resumo. |
| HiveNode app: `npx --no-install tsc --noEmit --incremental false` | Passou. Isso não valida execução nativa, reconexão ou integração com o servidor. |
| HiveMiner app: mesmo comando | Falhou em `src/app/index.tsx:908`, propriedade `estimatedItemSize` incompatível com os tipos instalados. |
| Broker: `go test ./...` | Falhou no teste de autenticação Redis. A fixture usa senha em texto, mas a implementação exige bcrypt. Não há testes no pacote de túnel. |
| Light: `go test ./...` em `native-go` | Pacotes compilam; nenhum possui testes. Não equivale a build do APK. |
| Docker local: listagem de containers | Nenhum container HiveNode listado. Outros projetos já ocupam 5432 e 6379, portas fixas do Compose local. |

Observação sobre isolamento dos testes: `broker/internal/redis/client_test.go:9-47` acessa Redis real em localhost, grava chaves fixas e só limpa parte delas. O teste foi executado e conectou ao Redis local existente. Deve usar instância/namespace exclusivo e limpeza completa.

## P0 — Corrigir imediatamente

### 1. Rota HTTP com operação destrutiva e sem autenticação

- Evidência: `web/src/app/api/clean/route.ts:5-9`.
- Um GET executa SQL que tenta remover o schema `public` com CASCADE. Não há autenticação na rota; o middleware também não cobre esse caminho.
- Impacto: risco de perda total dos dados se a rota estiver publicada e o banco permitir a execução.
- Ação: remover a rota da aplicação publicada; operações de reset devem existir apenas em ferramenta local controlada. Verificar exposição da versão implantada e disponibilidade de backup restaurável.

### 2. Cadastro público concede ADMIN pelo texto do e-mail

- Evidência: `web/src/app/api/auth/register/route.ts:34-60`.
- Atribui ADMIN e saldo elevado pelo sufixo do e-mail, sem confirmar posse da caixa postal, e já emite a sessão.
- Impacto: elevação de privilégio administrativa pelo cadastro.
- Ação: cadastro sempre CUSTOMER; concessão administrativa explícita, auditada e restrita. Revisar contas administrativas existentes e revogar sessões indevidas.

### 3. Broker não respeita o aparelho autorizado pela credencial

- Evidência: `broker/internal/tunnel/socks5.go:22-37,52-76`.
- A autenticação encontra o nodeId, mas o Dial ignora essa identidade e seleciona o primeiro aparelho encontrado no mapa global. Não filtra proprietário nem visibilidade.
- Impacto: tráfego de um cliente pode sair pelo aparelho privado de outro. Não há round-robin/failover real nessa seleção.
- Ação: transportar identidade da credencial até o Dial e aplicar política explícita para BYOD, compartilhamento e pool público. Testar isolamento com pelo menos dois clientes e nós públicos/privados.

### 4. Controles e transmissão do broker sem autorização

- Evidência: `broker/cmd/broker/main.go:43-116`; `broker/internal/tunnel/websocket.go:286-290`; `docker-compose.yml:99-102`.
- `/kick`, `/live-nodes`, `/internal/rename-node` e `/dashboard-stream` não exigem autenticação. O stream distribui eventos globais sem filtro por cliente. O Compose encaminha o domínio do broker sem restrição de caminho.
- Impacto: no modelo de publicação descrito, terceiros podem obter eventos/IDs, derrubar dispositivos e enviar comandos de renomeação. Logs dos apps incluem destinos TCP.
- Ação: separar a administração em interface interna autenticada, autenticar o stream e filtrar os eventos pelo usuário no servidor.

## P1 — Fluxos principais e consistência financeira

### 5. Cadastro de nós, proxies e assinaturas usa relação inexistente

- Evidência: `web/src/app/api/nodes/route.ts:51-67`, `web/src/app/api/proxies/route.ts:25-40`, `web/src/app/api/billing/subscribe/route.ts:31-38`; `web/prisma/schema.prisma:93-136`.
- As consultas fazem `include: { plan: true }`, mas Subscription só tem `planId`, sem campo de relação `plan`.
- Impacto: erros confirmados pelo TypeScript e consultas inválidas com o schema atual. Bloqueia onboarding e compra recorrente.
- Ação: corrigir relação/schema/migração e validar as rotas contra banco de teste.

### 6. Cliente comum não consegue obter catálogo de planos

- Evidência: `web/src/app/dashboard/billing/page.tsx:67-77`; `web/src/app/api/admin/plans/route.ts:11-13`.
- A página comercial consulta uma API que exige ADMIN. O erro é apresentado como lista vazia.
- Adicional: a criação automática inicial usa categoria `PROXIES`, ausente no enum atual (`route.ts:24,33,41`).
- Ação: endpoint público/autenticado de catálogo comercial, com filtro no servidor; CRUD administrativo separado; seed compatível com o schema.

### 7. Copiar senha e rotacionar credencial de proxy estão incompatíveis

- Evidência: `web/src/app/api/proxies/route.ts:53-66,103-107`; `web/src/app/dashboard/proxies/page.tsx:532,567-569`; `web/src/app/api/proxies/[id]/rotate/route.ts:22-32`; `broker/internal/redis/client.go:59-72`.
- A API retorna o hash bcrypt e a tela o trata como senha utilizável, inclusive na URL copiada.
- A rotação grava AES-GCM no Redis, enquanto o broker espera bcrypt. O formato criptografado ainda contém os mesmos separadores usados pelo parser.
- Impacto: credenciais copiadas falham; a nova senha deixa de autenticar após rotação.
- Ação: contrato único para armazenamento e autenticação. Exibir segredo apenas na criação/rotação ou implementar recuperação cifrada deliberada, sem confundir hash e senha.

### 8. Bloquear ou excluir no admin não revoga acesso no broker

- Evidência: `web/src/app/api/admin/nodes/[id]/route.ts`, `web/src/app/api/admin/proxies/[id]/route.ts`; `broker/internal/redis/client.go:39-79`; `broker/internal/tunnel/websocket.go:326-357`.
- Rotas administrativas só alteram PostgreSQL. O broker autentica pelo Redis, sem consultar bloqueio/saldo. A exclusão de nó pelo cliente tenta kick, mas também deixa segredos e credenciais Redis (`web/src/app/api/nodes/[id]/route.ts:18-25`).
- Impacto: painel e acesso real divergem; clientes que não respeitem a mensagem KICKED podem tentar reconectar com material ainda válido.
- Ação: revogar chaves e sessões, encerrar conexões e implementar reconciliação idempotente entre banco, Redis e broker.

### 9. Contabilização de consumo não está integrada de ponta a ponta

- Evidência: `broker/internal/tunnel/websocket.go:478-483,613-640`; `web/src/lib/worker.ts:16-65`; `web/worker/points-ledger.ts`; `web/package.json`; `web/Dockerfile:79-91`; `docker-compose.yml`.
- Broker grava `traffic_logs` quando o dispositivo desconecta; o worker de cobrança espera jobs BullMQ em `billing-queue`, sem produtor identificado.
- Não há inicialização dos workers nos comandos/serviços de implantação revisados.
- O worker de cobrança debita o dono do aparelho e incrementa todos os proxies desse nó, em vez de atribuir tráfego à credencial consumidora.
- O canal publicado `broker:disconnect` não tem consumidor no broker revisado.
- Impacto: cobrança, bloqueio por saldo e remuneração não são confiáveis na arquitetura atual.
- Ação: eventos duráveis por usuário consumidor, credencial, nó e sessão; unidades inteiras de bytes; worker dedicado e reserva/débito de saldo no caminho do tráfego. Separar receita do consumidor e remuneração do fornecedor.

### 10. Pontos podem ser perdidos, repetidos ou convertidos em excesso

- Evidência: `web/worker/points-ledger.ts:11-64`; `broker/internal/tunnel/websocket.go:404-405,478-483`; `web/src/app/api/billing/redeem-points/route.ts:14-45`.
- A fila de pontos é removida com LPOP antes da transação; falhas posteriores perdem os eventos.
- Contadores do nó permanecem acumulados ao reconectar e são reenviados na desconexão seguinte, permitindo repetição de tráfego contabilizado.
- Resgate verifica saldo antes da transação, sem condição de saldo suficiente no update; resgates concorrentes podem gastar os mesmos pontos.
- A taxa também diverge: worker concede 500 pontos/GB, app estima pontos/500, servidor converte por 100 por padrão. Isso precisa de definição comercial explícita.
- Ação: IDs únicos de eventos, confirmação após persistência, contador por sessão e débito condicional atômico. Uma fonte de verdade para a taxa.

### 11. Renovação de assinatura pode ser descartada como duplicata

- Evidência: `web/prisma/schema.prisma:138-147`; `web/src/app/api/webhooks/abacatepay/route.ts:109-155`.
- Cada renovação cria Payment com o mesmo `abacateSubId`, declarado único. Depois do primeiro pagamento, o conflito reverte a transação. O catch trata qualquer P2002 como evento já processado e responde sucesso.
- Impacto: renovação paga pode não atualizar período/histórico e não ser reprocessada.
- Adicional: esse ramo não credita GB incluídos nem reativa nós bloqueados; o catch externo também retorna sucesso em erros não tratados.
- Ação: chave única por cobrança/fatura, múltiplos pagamentos por assinatura, idempotência específica de evento e reconciliação financeira. Conferir contrato do gateway em sandbox antes da implantação.

### 12. Revogação de sessão e separação de tipos de token incompletas

- Evidência: `web/src/lib/auth.ts:50-98,132-161`; `web/src/app/api/auth/reset-password/route.ts:23-40`; `web/src/app/api/auth/qr-login/route.ts:11-18`.
- A verificação genérica aceita qualquer JWT assinado com a mesma chave, incluindo os de redefinição/QR, sem exigir tipo de sessão e claims adequados.
- Reset não consome o token nem invalida sessões existentes. Papel ADMIN é confiado ao JWT durante seus sete dias de validade.
- QR troca por sessão completa de usuário, inclusive administrativa, em vez de credencial limitada ao aparelho.
- Ação: tipos/audiences distintos, tokens de uso único, versão/revogação de sessão, consulta de privilégios vigentes e credenciais por dispositivo. Login também precisa de limitação de tentativas no nível da aplicação.

## Diagnóstico por aplicativo

### HiveNode Android

- TypeScript passou; HMAC corresponde ao broker e os hosts Web/Broker já estão separados.
- **Reconexão usa estado antigo:** listener NetInfo do primeiro render chama `connectToBroker` capturado com `serverIp`, `nodeId` e segredo inicialmente vazios. Os refs só verificam a condição; a conexão continua lendo state (`src/app/index.tsx:126-170,535-538`).
- **Segredo fora do armazenamento seguro:** token usa SecureStore, mas `tunnelSecret` fica no AsyncStorage (`index.tsx:281-289,371-377`).
- **Pagamento pelo app:** URL contém JWT em `mobile_token`, sem consumidor encontrado na Web. Pode perder sessão no navegador e expõe token em URL (`index.tsx:48-50`). Usar troca de código curto de uso único.
- **Desvincular cria nós órfãos:** logout limpa apenas estado local; próximo login cria outro nó, consumindo limite de aparelhos (`index.tsx:342-377,418-435`).
- Prioridade: motor de túnel separado da tela, estado explícito de conexão, identidade estável do dispositivo e testes nativos com tela apagada, reinício e troca Wi-Fi/4G.

### HiveMiner Android

- **Assinatura incompatível:** usa SHA256 de `nodeId:secret`; broker exige HMAC-SHA256 (`src/app/index.tsx:77-85`).
- **REST no endereço errado:** API_BASE padrão aponta ao host do broker, sem `/api`; app.json não sobrescreve essa configuração (`index.tsx:75,254,336`; `app.json:62-67`).
- **QR incompatível:** painel produz prefixo `hiveminer|`; app aceita `hivenode|` ou JSON (`web/src/app/dashboard/miner/page.tsx:28`; `index.tsx:234-244`).
- **Sessão não restaura:** grava segredo no SecureStore e lê do AsyncStorage (`index.tsx:123-138,296-299,380-383`).
- **Pontos não carregam:** lê `data.data.user`, mas `/api/auth/me` retorna usuário diretamente em `data` (`index.tsx:168-177`; `web/src/app/api/auth/me/route.ts:65`).
- **Tipos falham** na lista de logs. Compartilha ainda problemas de ciclo de vida e duplicação de código com HiveNode.
- Prioridade: corrigir contrato comum de API, autenticação, QR e persistência antes de publicar outro APK.

### HiveNode Light

- **Registro usa rota inexistente:** `/api/nodes/register`, com `deviceModel/type`; servidor oferece `/api/nodes` com `deviceName/visibility` (`android-app/app/src/main/java/br/alfastage/hivenode/light/LoginApi.java:78-82`).
- **Pacote DIAL incompatível:** cliente lê `dest`, broker envia `host` (`native-go/tunnel/websocket.go:203-205`; `broker/internal/tunnel/socks5.go:94-98`).
- **Não reconecta após queda:** após conectar, Start aguarda apenas cancelamento do contexto. ReadLoop encerra na queda sem sinalizar nova tentativa nem zerar `ws`; Status pode continuar ONLINE (`native-go/tunnel/websocket.go:101-106,150-157,315-324`).
- **Sem política de destino no dial local:** IP resolvido é conectado sem validação de rede privada (`native-go/tunnel/websocket.go:224-238`).
- Prioridade: compatibilidade de protocolo e estado real antes de otimização de memória ou suporte a mais aparelhos.

### HiveDocker

- **Primeira inicialização pode falhar:** `ensurePanelToken()` chama `addLog()` antes da inicialização de `logs`, causando acesso a constante antes da inicialização quando falta panelToken (`server.js:28-35,50-62`).
- **Autenticação procura REST no broker:** `config.serverIp` é host `api.*`, utilizado também nas rotas Web (`server.js:15,270,287,300,310`).
- **Vínculo nunca conclui na interface:** servidor retorna `{status:'success'}` e página procura `pollData.data.status` (`server.js:331`; `public/index.html:85-89`).
- **Backoff reiniciado a cada tentativa:** `startTunnel` zera retryCount antes da conexão (`server.js:75-95`).
- **Status/logs sem proteção:** `/api/status` não está nos middlewares de autenticação (`server.js:46-48,247-254`).
- Prioridade: bootstrap testável, configuração por variável de ambiente, separação de hosts, ciclo de conexão isolado e autenticação consistente das APIs.

### CLI Linux e painel Miner/B2B

- **CLI é uma simulação de operação:** gera nodeId pelo relógio, grava linkToken, não registra nó real nem inicia motor de túnel. Status apresenta tráfego fixo (`web/src/app/cli.sh/route.ts:31-40,99-109,129-135`).
- **Painel Miner:** procura pontos em `/api/nodes`, que só retorna nós, e exibe indicação fixa `REF-HIVE-992X` (`web/src/app/dashboard/miner/page.tsx:55-85,131-135`).
- **B2B em `/saas`:** dispositivos fixos, convite apenas com alert e gráfico placeholder (`web/src/app/saas/page.tsx:8-58`).
- Ação: implementar fluxo real ou sinalizar explicitamente indisponibilidade. Não mostrar sucesso, consumo ou ganhos fictícios como operação concluída.

## Confiabilidade e infraestrutura

1. **Escrita concorrente no mesmo WebSocket:** mutex está por VirtualConn, mas várias conexões TCP e comandos compartilham o mesmo websocket de aparelho (`broker/internal/tunnel/websocket.go:207-210,233-237,426-428`; `broker/cmd/broker/main.go:109`). Centralizar saída em fila/lock por aparelho para evitar panics/intercalação.
2. **Bloqueio do multiplexador:** envio direto a `vc.ReadCh` pode bloquear o único leitor de todos os fluxos do aparelho; não seleciona canal de fechamento (`websocket.go:520-522`). Implementar backpressure, cancelamento e limites por fluxo.
3. **Isolamento de mensagens:** comandos/dados são associados ao connId global, sem verificar se `vc.NodeID` é o aparelho remetente (`websocket.go:503-521,564-599`). Validar vínculo de sessão em cada pacote.
4. **Limites de recursos:** deadlines de VirtualConn são no-op, falta limite explícito de frame, quotas de conexões e cleanup integral de conexões virtuais na perda do dispositivo (`websocket.go:250-255,451-493`).
5. **Proteção de destinos incompleta:** validadores dos apps/Docker usam regex de host, sem validar o endereço efetivamente resolvido, e `split(':')` quebra IPv6 (`hivenode-app/src/lib/hostValidator.ts`; `hivedocker/hostValidator.js`). Validar IP final e conectar ao mesmo IP validado na ponta.
6. **Migrations destrutivas como fallback:** startup executa `db push --accept-data-loss` quando migrate falha e pode iniciar servidor mesmo após erro (`web/Dockerfile:79-83`). Remover fallback destrutivo; falhar deploy em migração inválida.
7. **Build ignora erros de tipos:** `web/next.config.ts:6`. Isso permite publicar consultas e componentes inválidos já detectados pelo compilador. Tornar typecheck obrigatório no CI.
8. **Configuração administrativa em arquivo temporário:** `.temp/system_settings.json` não tem volume no Compose. Pode não ter permissão de escrita no container e não é compartilhado/persistente entre réplicas (`web/src/lib/settings.ts:52-80`; `web/Dockerfile:54-64,89`). Usar banco e validação de valores.
9. **Configuração local conflita com outros projetos:** portas 5432/6379 fixas já ocupadas. Publicações usam todas as interfaces. Configurar portas/bind local e instâncias de teste independentes.
10. **Healthchecks incompletos:** Web valida só banco; broker retorna OK sem verificar Redis/workers/roteamento. Medir prontidão das dependências e sucesso real de conexão proxy.
11. **Escala horizontal não está resolvida:** conexões de aparelhos e tráfego ficam em memória local. Pub/Sub de eventos não encaminha tráfego SOCKS entre réplicas; sticky cookie HTTP não garante afinidade do cliente SOCKS.

## Ordem sugerida de execução

### Etapa 1 — Conter riscos e recuperar controle

- Remover reset HTTP, promoção automática a ADMIN e acesso público a controles internos.
- Corrigir isolamento de clientes/nós e revogação efetiva de credenciais.
- Impedir fallback destrutivo de migrations; validar backup e restauração.

### Etapa 2 — Entregar uma jornada completa confiável

- Escolher HiveNode Android + Web + broker como primeiro fluxo de referência.
- Corrigir relação Plan/Subscription, catálogo comercial, criação/rotação/cópia de proxy.
- Validar cadastro → compra → webhook → vínculo → conexão SOCKS → consumo → bloqueio → recarga → reconexão.
- Depois, alinhar Miner, Light, Docker e CLI ao mesmo contrato versionado.

### Etapa 3 — Tornar cobrança e recompensas auditáveis

- Ledger de bytes e eventos financeiros com idempotência e reconciliação.
- Worker dedicado monitorado; eventos duráveis; reserva de saldo e resgate atômico.
- Regras explícitas para BYOD, compra de GB, remuneração do fornecedor, expiração, cancelamento e estorno.

### Etapa 4 — Melhorar experiência e operação

- Onboarding com verificação de API, assinatura, permissão Android, túnel e teste externo de saída.
- Exibir estados reais: conectando, reconectando, sem rede, bloqueado, sem saldo e incompatibilidade de versão.
- Histórico de disponibilidade/consumo, limite de banda, pausa, uso apenas no Wi-Fi e bateria mínima.
- Convites B2B reais com papéis, limite de proxies e quota; histórico de alterações administrativas.
- Métricas de sucesso de dial, latência, desconexões, sessões concorrentes, memória e atraso das filas.
- Testes de integração/contrato entre todas as implementações, testes concorrentes financeiros e ensaios nativos de longa duração.

## Critérios mínimos para uma versão comercial estável

- Cliente A nunca usa nem observa nó privado de B.
- Rotação e bloqueio invalidam acesso real, inclusive conexões existentes quando aplicável.
- Uma cobrança/um evento de tráfego tem efeito exatamente uma vez no ledger.
- Reconexão não duplica nó, tráfego ou pontos e recupera a operação após troca de rede.
- Status do painel corresponde à conexão efetiva e existe diagnóstico de falha compreensível.
- Compilação, types, testes de contrato e integração passam em ambiente isolado.
- Migração, rollback operacional e restauração de backup foram exercitados.
