# DISPATCH — Explorer Survey 2 (Web System, API & Prisma)

- **Role**: Explorer (Architectural & Defect Survey)
- **Working Directory**: c:\Users\theja\HiveNode\.agents\teamwork\explorer_survey_2
- **Target Scope**:
  1. `web/` directory: package.json, next.config, tsconfig, Dockerfile.
  2. Database & ORM: `prisma/schema.prisma`, migrations, seeders, DB client configuration.
  3. Backend & API: API routes (`app/api/` or `pages/api/`), server actions, middleware, authentication & authorization (NextAuth, JWT, RBAC, tenant isolation, IDOR risks).
  4. Frontend UI/UX: Components, state management, layouts, pages, client-server communication.
- **Authoritative Reference**: Read `c:\Users\theja\HiveNode\.agents\teamwork\ORIGINAL_REQUEST.md`.

## Instructions:
1. Conduct an in-depth survey of the `web` component. Map all API routes, database models, middleware, and key frontend/backend components.
2. Identify architectural patterns, security risks (RBAC, IDOR, input validation, secret leaks), Prisma schema integrity issues, and preliminary defect indicators.
3. **STRICT READ-ONLY CONSTRAINT**: DO NOT modify any project source files or configurations.
4. Save your findings in `c:\Users\theja\HiveNode\.agents\teamwork\explorer_survey_2\survey_report.md`.
5. Write your `handoff.md` and send completion message back to orchestrator.


## 2026-10-20T19:09:02Z
[Message from 9f1f0c47-8d38-44f4-99a5-a7f725b2392b]
You are Survey Explorer 2 for the HiveNode ecosystem technical audit.
Your working directory is: c:\Users\theja\HiveNode\.agents\teamwork\explorer_survey_2
Read your instructions in: c:\Users\theja\HiveNode\.agents\teamwork\explorer_survey_2\DISPATCH.md
Read the user request in: c:\Users\theja\HiveNode\.agents\teamwork\ORIGINAL_REQUEST.md

Scope:
- web/ directory: Next.js configs, package.json, tsconfig, Dockerfile.
- Database & ORM: prisma/schema.prisma, migrations, seeds, prisma client usage.
- Backend & APIs: API routes, server actions, authentication/session logic (NextAuth/JWT), RBAC enforcement, IDOR vulnerabilities, input validation (Zod/etc).
- Frontend: pages, app router, layouts, components, client-side data fetching and error boundaries.

Tasks:
1. Explore and document all files, dependencies, API routes, database models, and components in web/.
2. Perform static analysis and code inspection to detect defects: TypeScript errors, broken imports, unhandled exceptions, database transaction issues, security vulnerabilities (missing auth checks, IDOR, injection, exposed secrets), layout/hydration bugs.
3. Write your detailed survey findings to: c:\Users\theja\HiveNode\.agents\teamwork\explorer_survey_2\survey_report.md
4. Write your handoff report to: c:\Users\theja\HiveNode\.agents\teamwork\explorer_survey_2\handoff.md
5. Send a completion message to the caller/orchestrator with a summary of findings.

STRICT CONSTRAINTS:
- Do NOT edit or modify ANY project source code or config files. Read-only mode.
- Report real verifiable bugs with exact file path and line numbers.
