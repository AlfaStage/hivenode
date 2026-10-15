# Backlog — HiveNode SMS e equipes

34 issues locais, prontas para importar. IDs HNS são referências documentais, não números do GitHub. Situação inicial de todas: TODO. Prioridade P0 indica dependência crítica; P1 parte do lançamento; P2 extensão condicionada. Não marcar execução concluída por leitura deste pacote.

## Ordem e dependências

A tabela segue a ordem proposta. Dependências formais prevalecem sobre a numeração: HNS-07 depende de HNS-08, que deve ser executada antes. HNS-28 (MCP remoto) é opcional para a release inicial; stdio em HNS-22 atende o canal MCP inicial.

| Issue | Entrega | Prioridade | Depende de | Requisitos |
|---|---|---|---|---|
| [HNS-01](HNS-01.md) | Validar contratos do produto, preços e gates de lançamento | P0 | — | R04, R06, R17, R21 |
| [HNS-02](HNS-02.md) | Investigar Android, foreground service e canal de distribuição | P0 | — | R05, R18, R20 |
| [HNS-03](HNS-03.md) | Preparar harness isolado, fixtures e simulador SMS | P0 | — | R20, R21 |
| [HNS-04](HNS-04.md) | Adicionar schema de contas, memberships e billing por conta | P0 | HNS-01 | R01, R02, R03, R04 |
| [HNS-05](HNS-05.md) | Criar backfill idempotente e camada de compatibilidade legado | P0 | HNS-03, HNS-04 | R01, R22 |
| [HNS-06](HNS-06.md) | Implementar contexto de conta e autorização por serviço/recurso | P0 | HNS-04, HNS-05 | R01, R03, R17 |
| [HNS-07](HNS-07.md) | Criar convites, gerenciamento de membros e transferência de OWNER | P0 | HNS-06, HNS-08 | R02, R03, R17 |
| [HNS-08](HNS-08.md) | Calcular entitlements independentes e capacidade global de equipe | P0 | HNS-04, HNS-06 | R02, R04, R22 |
| [HNS-09](HNS-09.md) | Migrar autorização proxy, broker, realtime e clients legados | P0 | HNS-05, HNS-06, HNS-08 | R03, R22 |
| [HNS-10](HNS-10.md) | Criar API keys por conta, scopes e revogação | P0 | HNS-06, HNS-07 | R13, R17 |
| [HNS-11](HNS-11.md) | Adicionar catálogo SMS, habilitação por aparelho e trial transacional | P0 | HNS-01, HNS-08, HNS-10 | R04, R06, R21 |
| [HNS-12](HNS-12.md) | Investigar gateway e implementar ciclo financeiro SMS isolado | P0 | HNS-08, HNS-11 | R04, R22 |
| [HNS-13](HNS-13.md) | Criar termos versionados, inventário SIM e política elegível | P0 | HNS-02, HNS-06, HNS-11 | R05, R06, R17 |
| [HNS-14](HNS-14.md) | Implementar descadastro marketing e evidências de finalidade | P0 | HNS-06, HNS-13 | R06, R16, R17 |
| [HNS-15](HNS-15.md) | Implementar serviço de mensagens, validação e idempotência | P0 | HNS-10, HNS-11, HNS-13, HNS-14 | R06, R07, R08, R13, R17 |
| [HNS-16](HNS-16.md) | Criar outbox, workers, agenda e recuperação Redis | P0 | HNS-03, HNS-15 | R07, R08, R19 |
| [HNS-17](HNS-17.md) | Implementar API de aparelho, lease e grants assinados | P0 | HNS-13, HNS-15, HNS-16 | R06, R07, R10, R13, R18 |
| [HNS-18](HNS-18.md) | Implementar eventos, state machine, diagnóstico e reconciliação | P0 | HNS-03, HNS-17 | R09, R10, R11, R15 |
| [HNS-19](HNS-19.md) | Criar lotes, templates, agenda e preview | P1 | HNS-15, HNS-17, HNS-18 | R08, R12 |
| [HNS-20](HNS-20.md) | Criar endpoints e entregas de webhook com SSRF e replay | P1 | HNS-10, HNS-18 | R15, R16 |
| [HNS-21](HNS-21.md) | Implementar exportação, retenção e exclusão segura | P1 | HNS-10, HNS-18, HNS-20 | R12, R16, R17 |
| [HNS-22](HNS-22.md) | Entregar MCP stdio com mesma política da REST | P1 | HNS-10, HNS-15, HNS-19 | R14, R13, R17 |
| [HNS-23](HNS-23.md) | Criar módulo Android nativo, inbox e executor SMS | P0 | HNS-02, HNS-17, HNS-18 | R05, R09, R10, R18 |
| [HNS-24](HNS-24.md) | Integrar agente e telas SMS no app principal | P0 | HNS-23, HNS-06, HNS-13 | R05, R06, R12, R18 |
| [HNS-25](HNS-25.md) | Modernizar Light e integrar SMS compatível sem perder proxy antigo | P1 | HNS-02, HNS-17, HNS-18, HNS-23 | R05, R18, R22 |
| [HNS-26](HNS-26.md) | Criar painel SMS, jornada de envio e resultados | P1 | HNS-06, HNS-13, HNS-15, HNS-18, HNS-19, HNS-20, HNS-21 | R12, R05, R09, R11 |
| [HNS-27](HNS-27.md) | Criar seletor de conta, equipe e cobrança integrada | P1 | HNS-07, HNS-08, HNS-12 | R01, R02, R04, R12 |
| [HNS-28](HNS-28.md) | Entregar MCP remoto OAuth como extensão condicionada | P2 | HNS-22, HNS-10 | R14, R13 |
| [HNS-29](HNS-29.md) | Adicionar observabilidade, suporte e métricas de custo | P1 | HNS-12, HNS-18, HNS-20, HNS-21 | R11, R19, R21 |
| [HNS-30](HNS-30.md) | Automatizar matriz completa, contratos, carga e chaos no CI | P0 | HNS-03, HNS-09, HNS-18, HNS-19, HNS-20, HNS-21, HNS-22, HNS-24, HNS-26, HNS-27, HNS-29 | R20, R21, R22 |
| [HNS-31](HNS-31.md) | Ensaiar migração, backup e rollback com dados representativos | P0 | HNS-05, HNS-09, HNS-12, HNS-30 | R01, R20, R22 |
| [HNS-32](HNS-32.md) | Homologar APKs e chips reais com o proprietário | P0 | HNS-24, HNS-25, HNS-30 | R05, R09, R18, R20 |
| [HNS-33](HNS-33.md) | Validar jurídico, custos, gateway real e distribuição | P0 | HNS-01, HNS-02, HNS-12, HNS-29 | R04, R06, R16, R17, R21 |
| [HNS-34](HNS-34.md) | Liberar piloto controlado, kill switch e checklist operacional | P0 | HNS-26, HNS-27, HNS-29, HNS-30, HNS-31, HNS-32, HNS-33 | R19, R20, R21, R22 |

## Rastreabilidade requisito → issues

| Requisito | Issues |
|---|---|
| R01 | [HNS-04](HNS-04.md), [HNS-05](HNS-05.md), [HNS-06](HNS-06.md), [HNS-27](HNS-27.md), [HNS-31](HNS-31.md) |
| R02 | [HNS-04](HNS-04.md), [HNS-07](HNS-07.md), [HNS-08](HNS-08.md), [HNS-27](HNS-27.md) |
| R03 | [HNS-04](HNS-04.md), [HNS-06](HNS-06.md), [HNS-07](HNS-07.md), [HNS-09](HNS-09.md) |
| R04 | [HNS-01](HNS-01.md), [HNS-04](HNS-04.md), [HNS-08](HNS-08.md), [HNS-11](HNS-11.md), [HNS-12](HNS-12.md), [HNS-27](HNS-27.md), [HNS-33](HNS-33.md) |
| R05 | [HNS-02](HNS-02.md), [HNS-13](HNS-13.md), [HNS-23](HNS-23.md), [HNS-24](HNS-24.md), [HNS-25](HNS-25.md), [HNS-26](HNS-26.md), [HNS-32](HNS-32.md) |
| R06 | [HNS-01](HNS-01.md), [HNS-11](HNS-11.md), [HNS-13](HNS-13.md), [HNS-14](HNS-14.md), [HNS-15](HNS-15.md), [HNS-17](HNS-17.md), [HNS-24](HNS-24.md), [HNS-33](HNS-33.md) |
| R07 | [HNS-15](HNS-15.md), [HNS-16](HNS-16.md), [HNS-17](HNS-17.md) |
| R08 | [HNS-15](HNS-15.md), [HNS-16](HNS-16.md), [HNS-19](HNS-19.md) |
| R09 | [HNS-18](HNS-18.md), [HNS-23](HNS-23.md), [HNS-26](HNS-26.md), [HNS-32](HNS-32.md) |
| R10 | [HNS-17](HNS-17.md), [HNS-18](HNS-18.md), [HNS-23](HNS-23.md) |
| R11 | [HNS-18](HNS-18.md), [HNS-26](HNS-26.md), [HNS-29](HNS-29.md) |
| R12 | [HNS-19](HNS-19.md), [HNS-21](HNS-21.md), [HNS-24](HNS-24.md), [HNS-26](HNS-26.md), [HNS-27](HNS-27.md) |
| R13 | [HNS-10](HNS-10.md), [HNS-15](HNS-15.md), [HNS-17](HNS-17.md), [HNS-22](HNS-22.md), [HNS-28](HNS-28.md) |
| R14 | [HNS-22](HNS-22.md), [HNS-28](HNS-28.md) |
| R15 | [HNS-18](HNS-18.md), [HNS-20](HNS-20.md) |
| R16 | [HNS-14](HNS-14.md), [HNS-20](HNS-20.md), [HNS-21](HNS-21.md), [HNS-33](HNS-33.md) |
| R17 | [HNS-01](HNS-01.md), [HNS-06](HNS-06.md), [HNS-07](HNS-07.md), [HNS-10](HNS-10.md), [HNS-13](HNS-13.md), [HNS-14](HNS-14.md), [HNS-15](HNS-15.md), [HNS-21](HNS-21.md), [HNS-22](HNS-22.md), [HNS-33](HNS-33.md) |
| R18 | [HNS-02](HNS-02.md), [HNS-17](HNS-17.md), [HNS-23](HNS-23.md), [HNS-24](HNS-24.md), [HNS-25](HNS-25.md), [HNS-32](HNS-32.md) |
| R19 | [HNS-16](HNS-16.md), [HNS-29](HNS-29.md), [HNS-34](HNS-34.md) |
| R20 | [HNS-02](HNS-02.md), [HNS-03](HNS-03.md), [HNS-30](HNS-30.md), [HNS-31](HNS-31.md), [HNS-32](HNS-32.md), [HNS-34](HNS-34.md) |
| R21 | [HNS-01](HNS-01.md), [HNS-03](HNS-03.md), [HNS-11](HNS-11.md), [HNS-29](HNS-29.md), [HNS-30](HNS-30.md), [HNS-33](HNS-33.md), [HNS-34](HNS-34.md) |
| R22 | [HNS-05](HNS-05.md), [HNS-08](HNS-08.md), [HNS-09](HNS-09.md), [HNS-12](HNS-12.md), [HNS-25](HNS-25.md), [HNS-30](HNS-30.md), [HNS-31](HNS-31.md), [HNS-34](HNS-34.md) |

## Publicar em um tracker, quando solicitado

Cada arquivo individual contém título, contexto, dependências, passos, caminhos, aceites e testes. Importar texto integral e mapear HNS-xx para número externo mantendo ambos no corpo. Conferir repositórios próprios dos apps; issues mobile podem ser publicadas no repo do app com link de dependência ao repo principal. Não publicar automaticamente só porque estes arquivos existem.

Exemplo de comando para uma publicação autorizada com GitHub CLI, usando o arquivo como body (ajustar OWNER/REPO explicitamente):

```text
gh issue create --repo OWNER/REPO --title "HNS-15: serviço de mensagens e idempotência" --body-file docs/hivenode-sms/issues/HNS-15.md
```

O exemplo não foi executado. Labels e milestones devem existir antes de referenciá-los. Nenhum envio de email/Slack ou mensagem a outros chats faz parte desta entrega.

