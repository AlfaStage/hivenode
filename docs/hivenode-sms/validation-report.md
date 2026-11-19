# Evidência de validação documental — 18/11/2026

Escopo: somente `docs/hivenode-sms/`. Esta evidência não indica implementação ou aprovação do produto.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| Links Markdown locais e fechamento de code fences | PASSOU |
| 38 issues, referências e dependências sem ciclos nem bloqueios de fase futura | PASSOU |
| 22 requisitos com cobertura no backlog e na matriz | PASSOU |
| 61 casos de teste especificados e IDs válidos nas issues | PASSOU |
| OpenAPI 3.1 com 51 caminhos e 61 operações, parâmetros, autenticação selecionada e refs locais | PASSOU |
| 80 schemas JSON Draft2020-12 | PASSOU |
| 23 exemplos positivos/negativos de payload | PASSOU |
| Estados alinhados, supressão após claim e limite de uma chamada física por mensagem no piloto | PASSOU |
| 23 cenários projetados para o simulador, execução real proibida | PASSOU |
| Testes de produto, API implementada, banco, pagamento, Android ou SMS real | NAO_EXECUTADO nesta entrega |

Comandos executados na raiz:

```powershell
node docs/hivenode-sms/scripts/validate-docs.cjs
python docs/hivenode-sms/scripts/validate-contracts.py
```

Ambos encerraram com exit code 0 e errors vazio. O validador Node verifica integridade documental e subconjunto estrutural de OpenAPI; não foi executado um linter completo de OpenAPI nem um servidor gerado desse contrato. Python valida schemas e exemplos, sem rede.

Os marcos de produto continuam `NAO_EXECUTADO`. A viabilidade, o Android principal, o Light e o piloto pago têm evidências próprias previstas. HNS-32 registra build, aparelho, linha e responsável quando a homologação ocorrer.

Não foram alterados código do produto, banco, preços publicados ou assinaturas. Issues são arquivos locais, não publicações remotas. Alterações preexistentes do repositório foram preservadas.
