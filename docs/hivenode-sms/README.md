# HiveNode SMS e equipes — pacote de execução

Versão: 1.0 • Data: 13/10/2026 • Situação: especificado, não implementado.

Este pacote transforma as decisões da conversa em trabalho executável. Não é evidência de que o produto existe, de aprovação jurídica, de aprovação da loja ou de testes de SMS reais. Nenhum serviço, banco, assinatura ou issue remota foi alterado nesta entrega.

## Ordem de leitura

1. [PRD](01-prd.md): problema, escopo, requisitos e critérios de sucesso.
2. [Negócio e cobrança](02-negocio-cobranca.md): planos, vagas, equipes e ciclo de assinatura.
3. [Arquitetura](03-arquitetura.md): componentes, limites e mapa do código atual.
4. [Dados e migração](04-dados-migracao.md): entidades, invariantes e migração de usuários para contas.
5. [Equipes e autorização](05-equipes-autorizacao.md): papéis, permissões, isolamento e proxy.
6. [API e MCP](06-api-mcp.md): contratos de entrada, respostas e ferramentas.
7. [Fila e protocolo](07-fila-protocolo.md): estados, execução, reconciliação e duplicação.
8. [Android](08-android.md): módulo nativo, chips, Light e segundo plano.
9. [Painel e jornadas](09-painel-jornadas.md): telas e experiências de uso.
10. [Segurança e conformidade](10-seguranca-conformidade.md): responsabilidades e controles.
11. [Testes](11-testes.md): ambiente, matriz, simulador e roteiro físico futuro.
12. [Entrega e operação](12-entrega-operacao.md): sequência, observabilidade e rollback.
13. [Decisões e fontes](13-decisoes-fontes.md): baseline, pendências e referências oficiais.
14. [Backlog](issues/README.md): issues locais individuais, dependências e ordem.
15. [OpenAPI](contracts/openapi.json): contrato projetado, ainda sem endpoints implementados.
16. [Máquina de estados](contracts/sms-state-machine.json) e [cenários do simulador](contracts/simulator-scenarios.json): referências estruturadas para implementação e testes.
17. [Situação da validação](validation-status.json): separa documentação conferida de produto/testes ainda pendentes.
18. [Guia do dev júnior](14-guia-dev-junior.md): exemplo de implementação de uma issue, revisão e resolução de bloqueios.
19. [Relatório de validação documental](validation-report.md): verificações executadas e limites da evidência.

## Como um dev júnior começa

1. Leia este índice e o PRD. Confirme o responsável pela revisão técnica.
2. Leia a issue da fase atual e todas as suas dependências. Não comece uma issue dependente antes dos contratos básicos.
3. Execute o baseline de testes em ambiente isolado, conforme [testes](11-testes.md). Registre falhas prévias separadamente.
4. Faça uma mudança pequena. Use a branch `codex/<id-da-issue>-<resumo>` por padrão, salvo orientação do time.
5. Inclua evidências dos critérios de aceite e dos testes indicados na issue. Não marque testes físicos como aprovados usando um simulador.
6. Peça revisão de quem entende segurança para alterações de autorização, migração, cobrança e execução de SMS.
7. Atualize a matriz de rastreabilidade e a situação da issue. Não publique produção apenas porque o CI ficou verde.

## Vocabulário

- **Conta/workspace:** organização lógica com equipe, recursos e assinaturas próprias. Uma pessoa pode integrar mais de uma conta.
- **Membro:** pessoa com login individual e vínculo com uma conta. Proprietário também ocupa vaga.
- **Nó/aparelho:** instalação vinculada à conta; pode executar proxy, SMS, ambos ou nenhum.
- **Linha/SIM:** assinatura ativa detectada no aparelho. Não é licença comercial adicional.
- **Mensagem:** intenção de comunicação com um destinatário.
- **Segmento:** parte física de um SMS dividido pelo Android; não equivale a uma mensagem lógica.
- **Tentativa:** uma execução autorizada de uma mensagem no aparelho.
- **Idempotência:** a mesma solicitação identificada por uma chave não cria outra mensagem.
- **Outbox:** registros de trabalho gravados na mesma transação dos dados; publicados para a fila depois.
- **Lease:** autorização temporária de execução. Expirar não prova que o modem deixou de enviar.

## Limites desta entrega

Os preços são baseline comercial aprovado para planejar, com validação de custos antes do lançamento. Jurídico, contratos das linhas, publicação de APK, gateway real, carga e testes físicos são gates explícitos. Os arquivos em `issues/` são issues prontas para importar, não issues publicadas no GitHub.

Os comandos de SMS/equipe ainda inexistentes são identificados como **A CRIAR**. Comandos do baseline existente são identificados como **EXISTENTE**. A documentação não deve transformar propostas em supostas funcionalidades prontas.

## Verificar este pacote

Na raiz do repositório:

```powershell
node docs/hivenode-sms/scripts/validate-docs.cjs
python docs/hivenode-sms/scripts/validate-contracts.py
```

O validador verifica links locais, IDs de requisitos, dependências das issues e referências internas do OpenAPI. Não testa o produto e não substitui um linter completo de OpenAPI.

O segundo comando requer `jsonschema` 4.x e verifica schemas Draft2020-12 e exemplos positivos/negativos. Também é somente validação documental, sem rede ou modem.
