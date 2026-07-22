# Plano Comercial e Estratégia de Preços - HiveNode

Este documento define a estratégia de monetização, pacotes de venda e a estrutura de custos do HiveNode, levando em consideração a infraestrutura inicial (VPS Contabo de $5.28/mês).

---

## 1. Estrutura de Custos e Limites (Servidor Contabo)

O servidor atual (4 vCPU, 8GB RAM, 200 Mbit/s) é **excelente** para começar o Broker em Go.
- **Vantagem do Go:** 8GB de RAM suportam facilmente mais de 100.000 conexões simultâneas (WebSockets/Túneis) se o código for bem otimizado.
- **Gargalo (Cuidado):** A porta de 200 Mbit/s permite um tráfego máximo de **~25 Megabytes por segundo**. 
  - Para WhatsApp e automações de texto/API, isso é infinito (suporta milhares de clientes).
  - Para Web Scraping pesado (baixando imagens/vídeos), a banda pode saturar.
- **Ação Técnica Necessária:** O `broker` precisará ter um limitador de banda (Rate Limit) por usuário para evitar que um único cliente consuma os 25MB/s inteiros.

---

## 2. Precificação: Pilar 1 (Persona 1 - Frota Privada / SaaS)

Para quem vai usar os próprios aparelhos para fugir de banimentos (WhatsApp, Ads), o modelo **OBRIGATORIAMENTE deve ser por Assinatura (Mensalidade)**.
**Por que não por GB?** Porque a internet e o 4G já são do cliente. Ele ficaria irritado de pagar por GB consumido de algo que é dele. Nós vendemos a *infraestrutura do túnel*.

### Sugestão de Planos (SaaS B2B):
1. **Plano Starter (Para pequenos automadores):**
   - **Preço:** R$ 49,90 / mês
   - **Limite:** Até 2 aparelhos conectados simultaneamente.
   - **Uso:** Tráfego ilimitado (com regra de uso justo no broker para não saturar a VPS).

2. **Plano Pro (Para Agências / Marketing):**
   - **Preço:** R$ 149,90 / mês
   - **Limite:** Até 10 aparelhos conectados simultaneamente.
   - **Uso:** Tráfego ilimitado + Suporte prioritário.

3. **Plano Enterprise (Para grandes operações / Disparos):**
   - **Preço:** R$ 399,90 / mês
   - **Limite:** Até 50 aparelhos conectados.
   - **Uso:** Tráfego ilimitado.

*Lucratividade:* Com apenas 10 clientes no Plano Pro (R$ 1.500/mês), você paga o servidor da Contabo (~R$ 30) e sobra quase 100% de margem.

---

## 3. Precificação: Pilar 2 (Persona 3 - Frota Global / Mercado de Proxies)

Para as empresas que **não têm aparelhos** e querem comprar tráfego da nossa rede Web3 (Persona 2), o modelo **OBRIGATORIAMENTE deve ser por Consumo (Por GB)**.
**Por que por GB?** Porque proxies residenciais/móveis são o ativo mais caro da internet. Fornecer IPs reais de outras pessoas é valioso, e você precisa pagar os provedores (Persona 2).

### Sugestão de Preços (Mercado Global de Tráfego):
O padrão global para "Mobile Proxies" (IPs de celular) é de $3 a $15 dólares por GB. Podemos entrar com um preço super competitivo no Brasil.

- **Pacote Básico:** R$ 25,00 por GB.
- **Pacote Intermediário:** R$ 100,00 por 5 GB (R$ 20/GB).
- **Pacote Avançado (Scrapers):** R$ 300,00 por 20 GB (R$ 15/GB).

*Dinâmica do Dinheiro:*
Se um cliente gasta R$ 100 (5 GB):
- **~70% (R$ 70):** Fica com o HiveNode (Margem Bruta).
- **~30% (R$ 30):** É repassado em formato de Tokens/Pontos Web3 para a Persona 2 (os donos dos aparelhos que rotearam esse tráfego).

---

## 4. O Roadmap de Vendas (Go-to-Market)

1. **Fase 1 (Validação e Caixa Imediato):**
   - Vender agressivamente o **Pilar 1 (Frota Privada)**.
   - Abordar grupos de WhatsApp de contingência (Facebook Ads), automação (Chatbots) e donos de agências.
   - Promessa: "Pare de perder chips e contas de WhatsApp. Use seus próprios celulares como proxy por R$ 49/mês".

2. **Fase 2 (Expansão Web3):**
   - Lançar a mineração de Tokens para a Persona 2.
   - Promessa: "Baixe o HiveNode, deixe rodando e ganhe dinheiro/cripto com seu Wi-Fi parado".

3. **Fase 3 (Venda Institucional de Tráfego):**
   - Com milhares de celulares na rede (Fase 2), ativar a venda por GB (Pilar 2) para empresas de mineração de dados, comparadores de preços e QA global.
   - Domínio `hivenode.com` operando como portal internacional aceitando cartão e criptomoedas.
