# Revisão e correções — 13/10/2026

Escopo: código local da Web/API, painel, cobrança, worker, broker Go, HiveNode, HiveMiner, HiveNode Light, HiveDocker e CLI. Alterações anteriores foram preservadas. Não houve publicação nem alteração de banco de produção.

HiveNode, HiveMiner e HiveDocker têm repositórios Git próprios. As correções nesses diretórios precisam acompanhar as mudanças do repositório principal em uma publicação futura.

## Correções

- Banco: a migração inicial estava vazia. Nova migração cria as 13 tabelas, enums, índices e relações; aplicada no banco isolado hivenode_test.
- APIs: preservação de HTTP 401/403, validação de entradas e respostas 400/404/409 adequadas.
- Vínculo: aprovação e consumo de códigos atomicamente no Redis; aprovação não sobrescreve outra e mantém o prazo original.
- Login: envio usa FormData, aceita preenchimento nativo e não redireciona por token antigo em localStorage. Formulário usa POST para não expor senha em URL se JavaScript ainda não estiver ativo.
- Sessões: login retorna campos públicos; páginas protegidas verificam tipo, versão e revogação. Middleware migrado para proxy do Next.js 16.
- Admin: tipos e carregamento corrigidos, estados de nós consultam Redis, dono da credencial é exibido corretamente e assinaturas ativas respeitam validade.
- Miner: botões de diálogo compatíveis com Base UI e conversão de pontos usando a taxa do servidor. Controle 2FA sem implementação agora indica indisponibilidade.
- Cobrança: renovação limita o dia ao último dia do mês, cobrindo fevereiro e anos bissextos. Retentativas de transações usam espera exponencial com variação.
- Apps Expo: reconexão sem estado React atrasado; mensagens TCP vinculadas à sessão correta, queda de rede fecha o socket antigo e scanner impede execução duplicada.
- Destinos: validação de IPv4/IPv6 cobre redes privadas, loopback, CGNAT, link-local e endereços mapeados. No Android, postinstall aplica validação do IP resolvido antes do TCP.
- Light: cancelamento de DNS/dials e conexões antigas, reconexão com backoff e parada após KICKED. Serviço passou a compartilhar processo com a Activity; configuração de assinatura Gradle corrigida.
- HiveDocker: reinício imediato, cancelamento durante DNS e logout durante vínculo. NODE_VISIBILITY permite capacidade pública ou frota privada.
- CLI: simulações substituídas pelo controle autenticado do HiveDocker. Status consulta estado real; vínculo registra aparelho real; erros HTTP propagam falha. Instalador usa arquivo temporário e URL delimitada para shell.
- Qualidade: tipos, erros e avisos do lint corrigidos sem desabilitar regras.

## Verificação

| Verificação | Resultado |
|---|---|
| Web — testes unitários | 15 testes passaram em 5 arquivos |
| Web — typecheck | Passou |
| Web — ESLint com --max-warnings=0 | Passou, sem erros nem avisos |
| Web — build | Passou, 42 páginas geradas |
| Integração Web/banco/Redis/broker | 17 cenários passaram: isolamento, autenticação, rotação, bloqueio, vínculo concorrente, resgate, consumo idempotente e totais exatos de bytes |
| Chromium — login e telas | Passou no servidor standalone do build de produção: login, dashboard, diálogo Miner, B2B e lista administrativa, sem erros JavaScript |
| Broker — go test e go vet | Passaram; autenticação também testada com Redis isolado |
| Light — go test e go vet | Passaram; 4 testes de regressão cobrem reconexão, Stop, KICKED e destinos/portas |
| HiveDocker | 4 testes passaram com HTTP, TCP e WebSocket locais |
| HiveNode/HiveMiner | Typecheck e testes de políticas de destinos passaram |
| CLI/instalador | Sintaxe validada com sh -n, sem executar scripts |

## Limites e trabalho restante

- APKs e operação Android em segundo plano não foram validados em aparelho físico. SDK Android e JDK não estavam disponíveis no ambiente verificado; mudanças nativas precisam entrar em novos builds.
- Pagamento real, e-mail, produção, restauração de backup e carga prolongada não foram exercitados. Eventos financeiros dos testes são sintéticos.
- Houve conflitos de serialização sob concorrência. Retentativas preservaram os totais e a idempotência, incluindo respostas 500 transitórias recuperadas pelo broker em algumas execuções. Capacidade máxima permanece sem certificação.
- A migração foi validada para instalação limpa. Banco existente criado por db push precisa de reconciliação/baseline antes da implantação. Nenhuma migração foi aplicada em produção.
- 2FA permanece sem implementação. A CLI depende de HiveDocker, curl e jq.

## Reproduzir

Inicie docker compose --project-name hivenode-test -f docker-compose.test.yml up -d --wait. O nome explícito evita reaproveitar COMPOSE_PROJECT_NAME de outro ambiente. Portas do teste: PostgreSQL 55432 e Redis 56379.

Na pasta web, defina DATABASE_URL=postgresql://hivenode_test:local-test-only@127.0.0.1:55432/hivenode_test e execute npm run db:migrate:deploy. Depois execute npm test, npm run typecheck, npm run lint e npm run test:integration. A integração inicia e encerra seus próprios processos nas portas 3100, 11000 e 11001. Depois do build, npm run test:browser verifica as telas no Chromium com o servidor standalone e contas de teste.

Execute npm test em hivedocker; go test ./... e go vet ./... em broker e hivenode-light/native-go; npm run typecheck nos apps Expo; node scripts/mobile-validation.cjs na raiz.

Para sintaxe da CLI, execute na pasta web node node_modules/tsx/dist/cli.mjs scripts/validate-cli.ts. TEST_REDIS_CONTAINER seleciona o contêiner Redis de teste.

Evidências das execuções finais: validation/integration.txt, validation/browser.txt e validation/build.txt.
