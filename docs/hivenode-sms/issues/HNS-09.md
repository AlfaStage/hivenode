# HNS-09 — Migrar autorização proxy, broker, realtime e clients legados

Prioridade P0 · TODO · Fase EXPANSAO · Responsável sugerido Go/backend; revisão de compatibilidade

## Contexto e objetivo

Entregar esta parte conforme o [PRD](../01-prd.md) e a [sequência de execução](../12-entrega-operacao.md).

## Dependências

- [HNS-05](HNS-05.md)
- [HNS-06](HNS-06.md)
- [HNS-08](HNS-08.md)

## Requisitos e leitura obrigatória

R03, R22

- [03-arquitetura.md](../03-arquitetura.md)
- [04-dados-migracao.md](../04-dados-migracao.md)
- [05-equipes-autorizacao.md](../05-equipes-autorizacao.md)

## Onde trabalhar

- `web/src/lib/proxy-access.ts`
- `web/src/app/api/internal`
- `web/src/app/api/dashboard-ticket`
- `broker/internal/tunnel`
- `hivedocker`
- `hiveminer-app`

## Passos de implementação

1. Migrar identidade do proxy em shadow preservando shares, Miner beta, bytes e saldo.
2. Revalidar permissões de WebSocket ativo e encerrar sessões afetadas por revogação.
3. Definir credenciais SOCKS revogáveis por membro ou rotação explícita da compartilhada. Encerrar conexões afetadas.
4. Regredir CLI, HiveDocker, Miner, clientes de túnel e integrações atuais.

## Critérios de aceite

- [ ] Permissões da equipe valem proxy sem confundir dono com funcionário.
- [ ] Shares/público/saldo continuam corretos e jamais autorizam SMS.
- [ ] Eventos e credenciais de outra conta não vazam.
- [ ] Evidência, limitações e riscos registrados no PR.

## Testes e evidências

Executar T04, T32, T43, T44, T45, T60 conforme o [plano de testes](../11-testes.md). Se o caso pertence à expansão ou a aparelho real, registrar a condição e a evidência disponível.

## Como revisar e entregar

Referenciar esta issue, anexar os testes e registrar compatibilidade e rollback aplicáveis. Marcar a entrega concluída após revisão e atualizar a fase no backlog.
