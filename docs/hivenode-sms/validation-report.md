# Evidência de validação documental — 13/10/2026

Escopo: somente `docs/hivenode-sms/`. Esta evidência não indica implementação ou aprovação do produto.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| Links Markdown locais e fechamento de code fences | PASSOU |
| 34 issues, referências e grafo de dependências sem ciclos | PASSOU |
| 22 requisitos com cobertura no backlog e na matriz | PASSOU |
| 54 casos de teste especificados e IDs válidos nas issues | PASSOU |
| OpenAPI 3.1: 42 paths / 52 operações, IDs, parâmetros e refs locais | PASSOU |
| 67 schemas JSON Draft2020-12 | PASSOU |
| 14 exemplos positivos/negativos de payload | PASSOU |
| Estados alinhados, sem cancelamento após grant nem retry direto de UNKNOWN/PARTIAL | PASSOU |
| 19 cenários projetados para o simulador, execução real proibida | PASSOU |
| Testes de produto, API implementada, banco, pagamento, Android ou SMS real | NAO_EXECUTADO nesta entrega |

Comandos executados na raiz:

```powershell
node docs/hivenode-sms/scripts/validate-docs.cjs
python docs/hivenode-sms/scripts/validate-contracts.py
```

Ambos encerraram com exit code 0 e errors vazio. O validador Node verifica integridade documental e subconjunto estrutural de OpenAPI; não foi executado um linter completo de OpenAPI nem um servidor gerado desse contrato. Python valida schemas e exemplos, sem rede.

O pacote mantém gates A/B/C/N/P/L como NAO_EXECUTADO. O gate P depende dos testes do proprietário daqui a alguns dias, sem data presumida. Envio real de produção segue desabilitado na especificação.

Não foram alterados código do produto, banco, preços publicados ou assinaturas. Issues são arquivos locais, não publicações remotas. Alterações preexistentes do repositório foram preservadas.
