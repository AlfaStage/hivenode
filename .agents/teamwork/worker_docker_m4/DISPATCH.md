# DISPATCH — Worker Docker Diagnostic Verifications (M4)

- **Role**: Worker (Docker Diagnostic Specialist)
- **Working Directory**: c:\Users\theja\HiveNode\.agents\teamwork\worker_docker_m4
- **Authoritative Reference**: Read `c:\Users\theja\HiveNode\.agents\teamwork\ORIGINAL_REQUEST.md`

## MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Execution Rules:
1. **UNIVERSAL DOCKER EXECUTION**: All commands (TypeScript typecheck, Prisma validation, Go vet/compile checks, test executions, compose validation) MUST be executed strictly inside Docker containers (e.g. `docker run --rm ...` or `docker compose ...`). NEVER execute node, tsc, go, npm or tests natively on the host!
2. **SERVICE LIFECYCLE**: Before running any diagnostic container, check `docker ps -a` and stop/remove any existing conflicting or orphaned test containers.
3. **STRICT READ-ONLY ON PROJECT FILES**: Do NOT modify or edit any project code, configuration, or manifest files. `git status --porcelain` must remain clean. If you create any temporary files, place them strictly in `c:\Users\theja\HiveNode\.temp\` and delete them when done.
4. Ensure no containers or temporary diagnostic files remain running/lingering when finished.

## Tasks to Execute via Docker:
1. Validate `docker-compose.yml` syntax and environment resolution using Docker.
2. Run Prisma schema validation in `web/prisma/schema.prisma` inside a Docker container (e.g., using `node:20-alpine` mounting `web`).
3. Run TypeScript typecheck / build diagnostics on `web/` inside a Docker container (`tsc --noEmit` or `npx tsc`). Capture real compiler errors.
4. Run Go build/vet check on `broker/` inside a `golang:alpine` Docker container. Capture real compiler/vet errors.
5. Check if any existing tests exist in `web` or `broker` and execute them inside Docker, recording real outputs.
6. Check apps (`hiveminer-app`, `hivenode-app`, `hivedocker`) dependencies and build scripts.
7. Record all exact raw command lines, outputs, exit codes, and error logs in:
   `c:\Users\theja\HiveNode\.agents\teamwork\worker_docker_m4\docker_diagnostic_report.md`
8. Write `handoff.md` and send completion message back to orchestrator.

## 2026-10-20T19:28:44Z
From: 9f1f0c47-8d38-44f4-99a5-a7f725b2392b
You are Worker Docker Diagnostics for Milestone M4 of the HiveNode ecosystem technical audit.
Your working directory is: c:\Users\theja\HiveNode\.agents\teamwork\worker_docker_m4
Read your instructions in: c:\Users\theja\HiveNode\.agents\teamwork\worker_docker_m4\DISPATCH.md
Read the user request in: c:\Users\theja\HiveNode\.agents\teamwork\ORIGINAL_REQUEST.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

STRICT CONSTRAINTS:
1. UNIVERSAL DOCKER EXECUTION: Every diagnostic command (tsc, typecheck, prisma validate, go vet, compose config, tests) MUST run strictly inside Docker containers (e.g. docker run --rm ...). Do NOT run node/go/npm natively on the host system.
2. Check and terminate any conflicting containers before starting (docker ps -a).
3. READ-ONLY on project code: Do NOT edit or modify any project code or config files. git status --porcelain must remain clean.
4. Clean up any temporary files in /.temp before finishing, and ensure no containers remain running.

Key Tasks:
1. Docker Compose validation: run docker compose -f docker-compose.yml config to capture variable warnings and resolution errors.
2. Web Prisma validation: run prisma validate inside a node container (e.g. docker run --rm -v "c:\Users\theja\HiveNode\web:/app" -w /app node:20-alpine npx prisma validate).
3. Web TypeScript diagnostic: run tsc --noEmit or similar typecheck inside a node container. Capture all type errors, broken imports, missing properties.
4. Broker Go validation: run go vet ./... and go build inside a golang container (e.g. docker run --rm -v "c:\Users\theja\HiveNode\broker:/app" -w /app golang:1.24-alpine go vet ./...). Capture all compile/vet errors.
5. Check if unit/integration tests exist in web or broker, and execute them inside Docker containers, recording exact outputs.
6. Verify and document all command outputs, exit codes, and compiler messages in:
   c:\Users\theja\HiveNode\.agents\teamwork\worker_docker_m4\docker_diagnostic_report.md
7. Write your handoff report to: c:\Users\theja\HiveNode\.agents\teamwork\worker_docker_m4\handoff.md
8. Send completion message back to the orchestrator.
