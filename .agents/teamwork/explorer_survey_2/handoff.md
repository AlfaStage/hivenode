# Handoff Report — Explorer Survey 2 (`web` Component Audit)

**Status**: Task Complete (Hard Handoff)  
**Agent**: Explorer Survey 2  
**Target Scope**: Componente `web` (Next.js, Prisma ORM, APIs REST, Auth/RBAC/IDOR, Frontend)  
**Date**: 2026-10-20  

---

## 1. Observation

Durante a inspeção minuciosa dos arquivos-fonte do diretório `web/` e arquivos de infraestrutura relacionados, foram observadas as seguintes evidências diretas:

1. **Middleware Next.js Inativo**:
   - Arquivo: `web/src/proxy.ts`, Linha 4: `export async function proxy(request: NextRequest)`.
   - Linha 20: `export const config = { matcher: ["/saas/:path*", "/miner/:path*", "/admin/:path*"] };`.
   - Busca no sistema de arquivos por `*middleware*`: 0 resultados no diretório `web/`.
   - O Next.js App Router exige `src/middleware.ts` com export `middleware`. O arquivo atual é ignorado pela runtime do Next.js.

2. **Invocação de Método Inexistente no Zod**:
   - Arquivo: `web/src/app/api/shares/route.ts`, Linha 18:
     `const body = z.object({ nodeId: z.string().uuid(), email: z.email(), maxProxies: z.number().int().min(1).max(100).default(1) }).parse(await request.json());`
   - O objeto `z` da biblioteca Zod não possui o método `email()`. O método correto é `z.string().email()`.

3. **Ponteiro Nulo em Registro de Telemetria**:
   - Arquivo: `web/src/app/api/internal/usage/route.ts`, Linhas 21-25:
     ```ts
     if (proxy.node.userId !== proxy.userId) {
       const points = gb * 100;
       await tx.user.update({ where: { id: proxy.node.userId! }, data: { hivePoints: { increment: points } } });
       await tx.pointsLedger.create({ data: { userId: proxy.node.userId!, amount: points, type: "TRAFFIC" } });
     }
     ```
   - No schema Prisma (`web/prisma/schema.prisma:55`), `Node.userId` é nullable (`userId String?`). Se `userId` for nulo, a condição é verdadeira e o update falha com `id: null`.

4. **Chave Criptográfica HMAC Hardcoded**:
   - Arquivo: `web/src/app/api/webhooks/abacatepay/route.ts`, Linha 6:
     `const publicKey = "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";`
   - Linha 16: `const expected = createHmac("sha256", publicKey).update(raw).digest("base64");`

5. **Inconsistência de Validação de Tamanho do `JWT_SECRET`**:
   - Arquivo: `web/.env`, Linha 3: `JWT_SECRET="hivenode_dev_secret_2026"` (23 caracteres).
   - Arquivo: `web/src/lib/auth.ts`, Linha 17: `if (!value || value.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");`.

6. **Enum Incompatível com Zod**:
   - Arquivo: `web/src/app/api/admin/subscriptions/[id]/route.ts`, Linha 15:
     `const body = z.object({ status: z.enum(SubStatus), planType: z.enum(PlanType).optional() }).parse(await request.json());`.
   - `SubStatus` e `PlanType` são objetos enum TypeScript gerados pelo Prisma, enquanto `z.enum` exige array/tupla de strings.

7. **Ação "Sync AbacatePay" Inexistente na Rota**:
   - Arquivo: `web/src/app/dashboard/admin/plans/page.tsx`, Linhas 91-95: invoca `POST /api/admin/plans` enviando `{ action: "sync_abacatepay" }`.
   - Arquivo: `web/src/app/api/admin/plans/route.ts`, Linhas 62-89: o handler POST não possui suporte a `action`, executando diretamente `prisma.plan.create` com campos obrigatórios ausentes.

8. **Teto Excessivamente Restrito de 1 MB**:
   - Arquivo: `web/src/app/api/internal/usage/route.ts`, Linha 7:
     `bytesRx: z.number().int().min(0).max(1048576), bytesTx: z.number().int().min(0).max(1048576)`.

9. **Inicialização Inválida do Adapter Prisma em Script de Limpeza**:
   - Arquivo: `web/clean.js`, Linha 5:
     `const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });`.
   - O construtor `PrismaPg` exige um `pg.Pool` ou `pg.Client`, não um objeto `{ connectionString }`.

10. **Caminho Relativo Quebrado para Dependência `ws`**:
    - Arquivo: `web/scripts/local-integration.ts`, Linha 16:
      `const WebSocket = require("../../hivedocker/node_modules/ws");`.

---

## 2. Logic Chain

1. **Da observação de `proxy.ts` à conclusão de falha no middleware**:
   O Next.js App Router baseia-se em convenções de nomenclatura estritas para seu ciclo de vida de requisições. Como o arquivo foi criado com nome `proxy.ts` e exportando `proxy`, o compilador Next.js não o empacota como middleware de borda. Consequentemente, as regras de controle de acesso de rota e redirecionamento de usuários desativados ou com escopo `device` não ocorrem no nível de middleware.

2. **Da observação de `z.email()` à conclusão de crash em B2B**:
   Na chamada de validação do Zod, `z.email()` tenta avaliar uma propriedade inexistente no namespace exportado de Zod, resultando em `TypeError` antes mesmo de o corpo da requisição ser inspecionado. Isso impossibilita a criação de convites de compartilhamento de nós.

3. **Da observação de `proxy.node.userId!` à conclusão de falha de telemetria**:
   Em nós públicos de datacenter ou infraestrutura centralizada onde `node.userId` é `null`, o acesso a `proxy.node.userId!` passa `null` para o comando `tx.user.update`. O Prisma Client rejeita a operação com erro de validação de argumentos, abortando a transação e interrompendo a telemetria do broker Go.

4. **Da observação da chave estática no webhook à conclusão de risco de segurança**:
   A inclusão de uma chave pública no código-fonte para verificação HMAC com digest base64 contradiz a lógica de segredo dinâmico de `src/lib/abacatepay.ts`, permitindo que requisições falsificadas de pagamento sejam forjadas e aprovadas se o atacante conhecer o segredo exposto.

---

## 3. Caveats

- **Execução Diagnóstica em Container Docker**: O comando `docker ps` no host nativo retornou `permission denied while trying to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`. Em conformidade estrita com a Regra 1 e a Regra 3 (proibição absoluta de execução de ferramentas diretamente no host nativo sem Docker), nenhum comando nativo de compilação ou teste foi rodado no host. Todas as constatações são baseadas em análise estática, rastreamento de referências e checagem de tipos e schemas.
- **Ambiente de Produção**: Os testes e auditorias consideraram o código-fonte estático e manifestos do repositório. Variáveis de produção injetadas via Coolify ou orquestrador externo não foram alteradas.

---

## 4. Conclusion

A auditoria diagnóstica do módulo `web` identificou **21 defeitos e vulnerabilidades** detalhados em `survey_report.md`.
- As proteções contra IDOR nas rotas de nós e proxies estão bem implementadas na camada de aplicação.
- No entanto, existem 5 falhas críticas que afetam diretamente o funcionamento do middleware, a criação de compartilhamentos B2B, a telemetria de tráfego de nós públicos e a integridade de credenciais no ambiente de desenvolvimento.
- Todos os erros reportados possuem caminho exato de arquivo, linha de código e evidência comprovável.

---

## 5. Verification Method

Para verificar independentemente os defeitos identificados:

1. **Verificação de `proxy.ts`**:
   - Inspecione a documentação oficial do Next.js sobre Middleware (`https://nextjs.org/docs/app/building-your-application/routing/middleware`).
   - Verifique a ausência de `middleware.ts` no diretório `web/src/`.

2. **Verificação de `z.email()`**:
   - Abra `web/src/app/api/shares/route.ts` na linha 18 e inspecione as tipagens e métodos disponíveis no objeto `z` importado de `zod`. Observe que `z.email` é indefinido (apenas `z.string().email()` existe).

3. **Verificação de `proxy.node.userId` nulo**:
   - Abra `web/prisma/schema.prisma` na linha 55 e observe `userId String?`.
   - Abra `web/src/app/api/internal/usage/route.ts` nas linhas 21-25 e observe a ausência de checagem `if (proxy.node.userId)` antes de invocar `tx.user.update`.

4. **Verificação do tamanho de `JWT_SECRET`**:
   - Compare o valor de `JWT_SECRET` em `web/.env:3` (23 caracteres) com a validação em `web/src/lib/auth.ts:17` (`value.length < 32`).

5. **Verificação de `clean.js`**:
   - Compare `web/clean.js:5` com `web/src/lib/prisma.ts:20-26`. Observe que `PrismaPg` recebe um objeto com `connectionString` em vez de um `pg.Pool`.
