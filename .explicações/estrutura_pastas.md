# Estrutura de Pastas e Separação de Microsserviços

Este documento mapeia a estrutura fundamental de diretórios do projeto **HiveNode**, detalhando por que certos serviços foram separados de acordo com a nossa stack tecnológica e o princípio de modularização.

## Divisão de Diretórios

### `/web`
- **Escopo:** Front-end, Painel de Gestão e API Back-end (Node.js/Next.js).
- **Justificativa:** Como ambos utilizam Node.js e compartilham de uma mesma estrutura (App Router do Next.js), o servidor e o front ficam consolidados aqui, facilitando o compartilhamento de tipos (TypeScript) e rotas unificadas.

### `/broker`
- **Escopo:** O motor de rede, servidor Proxy SOCKS5 e gerenciador de túneis.
- **Justificativa:** É desenvolvido inteiramente em **Go (Golang)**. Por possuir seu próprio gerenciamento de pacotes (`go.mod`), concorrência nativa extrema (Goroutines) e ciclo de vida diferente do painel web, ele deve ser obrigatoriamente um microsserviço isolado em sua própria pasta. Misturá-lo com código JavaScript causaria quebras no encapsulamento e regras de negócio.

### `/android`
- **Escopo:** Aplicativo cliente móvel (Nó).
- **Justificativa:** Por ser o worker que rodará nativamente em celulares utilizando Kotlin/Java ou Flutter, possui toda a estrutura nativa de builds móveis (Gradle, Manifests, etc). Deve estar totalmente isolado do código do servidor, servindo apenas para se conectar à infraestrutura via WebSockets/gRPC.

## Resumo Arquitetural
A comunicação entre o `/web` e o `/broker` ocorrerá via **Redis** (para eventos em tempo real, como autorização de túnel e saldo de dados) e chamadas HTTP REST internas, garantindo a **Regra 4 (Modularização & Componentização)** estrita.
