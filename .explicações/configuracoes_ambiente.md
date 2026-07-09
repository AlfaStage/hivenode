# Configurações de Ambiente (Variáveis)

Este documento mapeia as variáveis de ambiente necessárias para o correto funcionamento do Servidor e Front-end (Next.js / Node.js) da plataforma HiveNode, localizados na pasta `web/`.

## Arquivo `.env` do Backend/Frontend

O arquivo `web/.env` contém as seguintes chaves fundamentais:

*   **`NEXT_PUBLIC_APP_URL`**: Define a URL base para o frontend (Ex: `http://localhost:3000` ou `https://hivenode.alfastage.com.br`).
*   **`DATABASE_URL`**: String de conexão ao PostgreSQL externo utilizando o Prisma.
*   **`REDIS_URL`**: String de conexão ao Redis externo. Centraliza as operações em tempo real para o Next.js, filas do BullMQ e acesso do Broker Go.
*   **`JWT_SECRET` / `ENCRYPTION_KEY`**: Chaves randômicas essenciais para geração de tokens de sessão, autenticação e possível criptografia extra.
*   **`ABACATE_PAY_API_KEY` / `ABACATE_PAY_WEBHOOK_SECRET`**: Credenciais para controle do gateway de pagamentos v2.
*   **`BROKER_API_URL` / `BROKER_SOCKS_PORT`**: Endereços do microserviço Go (O motor de rede) para garantir que a API Next.js saiba qual rota expor para os nós locais na rede interna.

## Considerações
*   Essas variáveis não devem ser expostas (exceto as prefixadas por `NEXT_PUBLIC_`).
*   Qualquer novo serviço (ex: filas novas no BullMQ, buckets AWS S3) que demande credenciais deverá ter sua chave adicionada primeiramente ao ambiente e documentada aqui.
