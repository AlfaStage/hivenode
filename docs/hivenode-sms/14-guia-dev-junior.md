# Guia de execução para dev júnior

## Antes de começar

O pedido atual entregou documentação e backlog. A implementação começa pelas issues e deve ser revisada em etapas. Não tente implementar todos os arquivos de uma vez nem iniciar pelo botão de envio: migração, autorização e execução segura são pré-requisitos.

Escolha a primeira issue liberada por dependências em [backlog](issues/README.md). HNS-01/HNS-02/HNS-03 podem começar sem schema SMS. Depois HNS-04 → HNS-05 → HNS-06 → HNS-08 → HNS-07. A numeração não substitui o grafo.

## Exemplo de trabalho: HNS-15

1. Confirme que HNS-10/11/13/14 e suas dependências passaram revisão.
2. Leia PRD R06/R07/R08/R13/R17, [API](06-api-mcp.md), [protocolo](07-fila-protocolo.md) e OpenAPI sendSms.
3. Liste invariantes antes de editar: conta fixa, nó/SIM próprios, membro/chave com permissão, linha elegível, supressão, agenda, idempotência e outbox atômica.
4. Crie teste de caso negativo primeiro: conta A pede nó B →404, mensagem/outbox zero. Use fixture de test, nunca node real.
5. Crie teste de duas chamadas paralelas com mesma chave → mesmo ID, uma mensagem, uma outbox. Diferente texto →409 sem segunda intenção.
6. Implemente função de domínio independente do handler HTTP. Handler só autentica, valida contrato, chama a função e transforma resposta.
7. Não acople criação da mensagem ao modem: a saída 202 é persistência da intenção.
8. Rode testes específicos, typecheck, lint e integração relevante. Só ampliar testes por nova mudança/risco.
9. Confira payload/logs: sem body em fila/log, sem segredo API, nenhum telefone real.
10. PR explica resultado, testes e riscos. Marque HNS-15 concluída só depois da revisão; gate físico continua pendente.

## Critérios para escolher onde escrever

| Preciso fazer... | Local projetado |
|---|---|
| Verificar membership/permissão | `web/src/lib/workspaces/` |
| Calcular plano/vagas | `web/src/lib/entitlements/` |
| Validar intenção SMS | `web/src/lib/sms/service/` |
| Aplicar estado/evento | `web/src/lib/sms/state-machine/` |
| Conceder tentativa física | `web/src/lib/sms/device/` |
| Enviar job/webhook/retention | `web/src/workers/` + módulos jobs |
| Renderizar tela | `web/src/app/dashboard/sms/` |
| Chamar modem | Módulo nativo autorizado do Android, nunca página/API/worker |
| Expor ferramenta MCP | Bridge `mcp/`, chamando a mesma REST |

## Checklist de revisão do júnior

- [ ] Li AGENTS.md da área e documentação da versão instalada.
- [ ] Não substituí alterações de outros trabalhos no repositório.
- [ ] Validei pelo servidor, e não só por esconder botão.
- [ ] Toda consulta de cliente inclui workspaceId verificado.
- [ ] Estados/prazos/retry seguem o contrato; UNKNOWN nunca vira reenvio por conveniência.
- [ ] Testes provam efeito e ausência de efeito, não apenas status HTTP.
- [ ] Usei dinheiro inteiro e tempo UTC com apresentação de fuso.
- [ ] Mensagens/segredos não estão em logs, tickets, analytics ou issues públicas.
- [ ] Migração é aditiva, ensaiada e não usa reset para resolver conflito.
- [ ] Teste de aparelho não foi declarado aprovado por emulador/simulador.
- [ ] PR lista dependências, evidência e gate restante.

## O que fazer quando trava

Falha de endpoint: primeiro contrato/status/requestId, depois auth/contexto, depois transação/state. Falha de entrega: identificar claim/grant/INVOKING/callback/ACK. Não adicionar retry genérico em todos os catch.

Sem JDK/SDK: continuar backend/simulador e registrar gate N bloqueado. Sem aparelho: continuar gates A/B/C/N, manter gate P pendente. Sem contrato de linha: não ligar modem, usar fake. Gateway sem operação: ADR e fluxo alternativo real, sem simular cobrança paga. Migração divergente: interromper cutover e pedir revisão de dados.

Procure revisão experiente antes de auth, cobrança, grant, modem, backfill, restore e liberação real. As issues determinam quem valida; a documentação não transfere essas decisões jurídicas/operacionais ao júnior.
