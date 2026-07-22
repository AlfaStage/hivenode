# Tokenomics e Sistema de Recompensas Web3 - HiveNode

Este documento detalha o funcionamento financeiro e tecnológico para a **Persona 2** (os provedores de dispositivos da Frota Global), explicando como eles ganham criptomoedas/tokens ao disponibilizarem suas redes.

Este modelo baseia-se nas melhores práticas de redes **DePIN (Decentralized Physical Infrastructure Networks)**.

---

## 1. O Modelo de Pontuação (Off-Chain vs On-Chain)

Para que o sistema seja escalável e não gere taxas abusivas de rede (gas fees) a cada minuto, o ganho é dividido em duas etapas:

1. **Off-Chain (Interno no Banco de Dados):** Enquanto o aplicativo está rodando, o usuário "minera" **Pontos Hive** (ou "Honey"). Isso é apenas um número no nosso banco de dados (PostgreSQL/Redis), o que custa zero taxas.
2. **On-Chain (O Saque / Blockchain):** Quando o usuário atinge um limite mínimo (ex: 10.000 Pontos), ele clica em "Sacar" (Claim). Nesse momento, conectamos à blockchain e enviamos a criptomoeda real para a carteira dele (MetaMask, Phantom, etc.).

---

## 2. Como se Minera (Ganha) Pontos?

O algoritmo de recompensa do app Android deve ser baseado em dois pilares principais para garantir que a rede seja útil comercialmente:

### A) Proof of Uptime (Prova de Tempo Online)
- O usuário ganha uma quantidade fixa de pontos apenas por manter o aplicativo aberto, conectado ao Wi-Fi/4G e com bateria (ex: 10 Pontos por Hora).
- **Por quê?** Isso garante que sempre teremos uma gigantesca "piscina de IPs" disponível, mesmo que ninguém esteja comprando aquele tráfego no exato momento.

### B) Proof of Traffic (Prova de Tráfego Roteado)
- Quando a **Persona 3** (Comprador) efetivamente usa o celular daquele usuário para baixar dados ou navegar, o dono do celular ganha um bônus pesado (ex: 500 Pontos por GB trafegado).
- **Por quê?** Isso incentiva os usuários a colocarem aparelhos em conexões rápidas (Fibra/5G).

### C) Bônus de Indicação (Referral Viral)
- O usuário ganha 10% de todos os pontos que seus indicados minerarem, para sempre. É assim que redes DePIN atingem milhões de usuários em poucos meses sem gastar com anúncios.

---

## 3. A Moeda Própria ($HIVE) e o Mecanismo de Queima (Burn)

Conforme definido, o projeto terá seu próprio token nativo, o **$HIVE**. 

### O que é a "Queima" (Burn) e como ela gera valor?
Para explicar de forma bem simples: imagine que o $HIVE seja como "ações" de uma empresa e exista um limite máximo de moedas no mundo (ex: 1 Bilhão de moedas). 
Se uma moeda não tem utilidade, o preço dela cai a zero. Mas nós temos um fluxo de dinheiro real entrando: as empresas (Persona 3) pagando por tráfego.

**O Ciclo do Dinheiro (A Mágica da Queima):**
1. **Entrada de Dinheiro Real:** Uma empresa (Persona 3) entra no painel corporativo e paga $1.000 Dólares via Cartão de Crédito ou USDT para comprar pacotes de Proxies.
2. **A Compra de Volta (Buyback):** O HiveNode separa uma porcentagem desse lucro (ex: 30%, ou seja, $300 Dólares). O sistema vai automaticamente no mercado de cripto e compra $300 Dólares da moeda $HIVE.
3. **A Queima (Burn):** O sistema pega essas moedas $HIVE que acabou de comprar e as envia para uma "Carteira Morta" (um endereço de blockchain que ninguém tem a senha). As moedas são destruídas para sempre.
4. **O Efeito:** Como as moedas sumiram do mercado, a quantidade total de $HIVE no mundo diminui (escassez). Como a demanda se mantém e a oferta diminui, o preço do $HIVE que os mineradores têm na carteira **sobe**. 
É assim que o usuário ganha dinheiro: não porque tiramos do nosso bolso, mas porque o dinheiro dos clientes corporativos está constantemente recomprando a moeda deles.

---

## 4. O Ecossistema Isolado do Minerador (O "Hive Miner")

Para não misturar o cliente corporativo (SaaS) com o usuário final (Minerador), criaremos uma interface e um aplicativo completamente separados.

### A) O Aplicativo (App "Hive Miner")
- **Público:** Pessoas comuns (Persona 2).
- **Funcionalidade:** Simples e gamificado. Terá apenas um botão gigante "Conectar", um gráfico subindo em tempo real mostrando os Pontos (Off-chain) minerados no dia, e o link de convite (Referral). 
- **Sem complexidade:** O usuário não precisa saber o que é Proxy ou SOCKS5. Ele só sabe que está "compartilhando a internet para minerar cripto".

### B) O Painel Web do Minerador (ex: `miner.hivenode.com`)
- Um painel focado 100% no resgate (Claim).
- É onde a pessoa faz login, conecta a carteira (MetaMask/Phantom) e converte seus Pontos Off-Chain nos tokens **$HIVE** reais que vão cair na carteira dela.
- Pode exibir um ranking (Leaderboard) global de quem mais minerou na semana, estimulando a competição.

---

## 4. O Fluxo de Tela para o Usuário (App Android)

Para que a experiência seja "Mágica" para a Persona 2, o aplicativo Android não precisa ser complexo:

1. **Dashboard Principal:** Um gráfico em tempo real mostrando o "Uptime" do dia e os "Pontos" subindo (uma animação visualmente satisfatória é crucial aqui).
2. **Status da Rede:** Indicadores de ping, força do sinal e IP atual.
3. **Aba de Wallet (Carteira):** Um botão para conectar a carteira Web3 (ex: Solana Phantom Wallet) e o botão de "Claim" (Sacar) que só acende quando atinge o limite.
4. **Link de Convite:** Botão gigante de "Convide amigos e ganhe 10%".

---

## 5. Estratégia de Maximização de Lucro e Isolamento (FIAT vs Cripto)

A regra de ouro de negócios Web3 rentáveis é: **Não force o cliente corporativo a usar a sua Cripto.**

### Isolamento do Pilar 1 (SaaS)
- Os clientes da **Persona 1** (que assinam o plano de R$ 49 para usar os próprios aparelhos) pagam em **Dinheiro Real (Pix/Cartão)**. Eles não querem saber de Web3.
- Esse dinheiro é **Lucro 100% da Empresa**, usado para pagar os servidores (Contabo) e equipe.

### A Jornada de Pagamento da Persona 3
- As empresas que compram tráfego da rede global também pagam em **Dólar/Cartão**. 
- Apenas *nos bastidores* o sistema pega uma parte desse dinheiro e compra o $HIVE para fazer a "Queima".

### O "Cheat Code" do Lucro Máximo (Para os Fundadores)
Como você, sendo dono do sistema, fica milionário com a criptomoeda?
1. **Retenção de Supply (Tesouraria):** Quando você criar a moeda $HIVE, você define que 20% de todas as moedas que existem pertencem à equipe fundadora (Você).
2. **Valorização Passiva:** Como você tem a máquina que gera a queima (Burn) rodando com o dinheiro dos clientes, o preço do $HIVE sobe sem parar.
3. **A Venda Lenta:** Quando o token valorizar absurdamente por causa do hype e da queima, você vende frações minúsculas da sua "Tesouraria" de 20% no mercado aberto. É assim que os criadores de projetos DePIN faturam milhões sem tirar dinheiro do fluxo de caixa da empresa.

---

## 6. A Utilidade do Token (Economia Circular e P2P)

A pergunta mais importante de todo projeto Web3 é: *"Para que serve esse token além de vender?"* 
Se a **Persona 2** (Minerador) quiser, ela pode usar os próprios tokens $HIVE que minerou para comprar acesso à rede de proxies. Isso cria uma **Economia Circular** brilhante.

### Como funciona a Matemática Interna (A Cotação Dinâmica)
Você tocou no ponto mais crítico: a volatilidade da moeda não pode prejudicar o cliente. A regra de ouro aqui é o **Lastro em Dólar (Fiat Peg) + Saldo Fixo em GB**.

O preço do produto é **Sempre Fixo em Dólar** (ex: 1 GB = $5 Dólares). O valor do $HIVE flutua livremente no mercado (DEX).

1. **A Compra (Checkout Dinâmico):** 
   Se hoje 1 $HIVE vale $1 Dólar, o sistema cobra 5 $HIVE por 1 GB.
   Se amanhã o $HIVE despencar e valer $0.10, o sistema cobra 50 $HIVE por 1 GB. 
   O sistema lê o preço da moeda em tempo real (usando um Oráculo de preços) na hora exata do pagamento.

2. **A Blindagem do Saldo (O que o cliente comprou, é dele):**
   No momento em que a compra é aprovada, o sistema converte imediatamente a transação e salva no banco de dados: `Saldo: 5 GB`. 
   Não importa se no dia seguinte a moeda $HIVE foi a zero ou multiplicou por 1.000x. O cliente tem **5 GB garantidos**. O saldo dele só diminui se ele **consumir o tráfego**. O risco da variação da cripto não existe para o cliente.

3. **Para o Cliente Descomplicado:** 
   Ele entra, passa o Cartão de Crédito pagando $5 Dólares e recebe 1 GB. Nos bastidores, a sua empresa recebe os Dólares, pega o lucro e, se quiser, compra $HIVE no mercado para "queimar" e valorizar a sua própria tesouraria.

**Conclusão:** Ao precificar seu produto sempre em Dólar (e usar o $HIVE apenas como meio de troca momentâneo que flutua), você dá um valor real ao token sem expor o seu negócio ou o seu cliente a riscos de mercado.

---

## 7. Emissão da Moeda e Taxas de Rede (Smart Contracts)

### Como as moedas são criadas? (O Suprimento Fixo)
Na Web3 moderna, nós **NÃO** criamos moedas infinitamente conforme os mineradores vão trabalhando (isso geraria inflação infinita e destruiria o preço, como aconteceu no Axie Infinity).

O modelo correto é o **Supply Fixo (Pré-Minerado):**
1. No Dia 1 do projeto, você emite um Smart Contract na blockchain criando todas as moedas que vão existir na história (Exemplo: 1 Bilhão de $HIVE).
2. Nenhuma moeda nova pode ser criada depois disso.
3. Essas moedas ficam trancadas em uma "Conta Mestre" (Um Smart Contract de Tesouraria impenetrável).
4. Quando o usuário clica em "Sacar" (Claim) no painel web, o nosso sistema manda um comando seguro para a Conta Mestre: *"Libere 1.000 moedas para a carteira X"*.
5. A Conta Mestre simplesmente **distribui** as moedas que já estavam criadas.

### Taxas Administrativas e Burn Automático em Transações (Taxes)
Para tirar ainda mais lucro do sistema, o Smart Contract da moeda terá uma função de **Taxa de Transferência**.
Toda vez que alguém transferir $HIVE para outra pessoa (P2P) ou vender na corretora descentralizada, o contrato cobra uma taxa automática (ex: 2% a 5%).

- **Metade da Taxa:** Vai direto para a queima (Burn), ajudando o preço a subir.
- **Metade da Taxa:** Vai para a sua "Conta Mestre Administrativa" como lucro puro, apenas por eles estarem movimentando a economia da sua moeda.

---

## 8. Infraestrutura Web3: A Rede e a Listagem

### Qual Blockchain escolher para fugir das Taxas de Rede (Gas Fees)?
Para que o usuário não perca os lucros pagando taxas para a rede, precisamos de blockchains ultrarrápidas e baratas. As três melhores opções para o HiveNode são:

1. **Solana (SOL):** É a atual "Rainha" dos projetos DePIN (onde estão Helium e Grass). As taxas são frações de centavos de dólar. A carteira usada é a **Phantom Wallet**.
2. **Base (Rede da Coinbase):** Uma das redes que mais crescem no mundo, construída sobre o Ethereum (L2). É absurdamente barata e atrai muito capital corporativo.
3. **Polygon (MATIC):** Tradicional, barata e testada. 

*(Tanto a **Base** quanto a **Polygon** são nativas da **MetaMask**, o que facilita a vida do usuário comum).*

### Como a moeda aparece na MetaMask das pessoas?
Na Web3, tudo é público. No dia que criarmos o Token $HIVE, a blockchain vai gerar um **Endereço de Contrato (Contract Address)** único (ex: `0xAbC123...`). 
Tudo o que o usuário precisa fazer é abrir a MetaMask dele, clicar em "Importar Token" e colar esse código. A carteira automaticamente puxa o nome, a logo e o saldo de $HIVE dele. No nosso app/painel `miner.hivenode.com`, nós colocamos um botão "Adicionar à MetaMask" que faz isso com um clique.

### Como a moeda entra nas Corretoras para ser comprada/vendida?
Nós **não** precisamos pedir permissão para a Binance ou Mercado Bitcoin. Nós começamos nas **Corretoras Descentralizadas (DEX)**, como a *Uniswap* (se for Polygon/Base) ou *Raydium* (se for Solana).

**O Processo (Piscina de Liquidez):**
1. Você cria uma **Piscina de Liquidez (Liquidity Pool)**.
2. Você coloca lá um pouco de Dólar (ex: $5.000 ou $10.000 USD do seu caixa inicial) e uma quantidade de $HIVE. 
3. Isso cria o **Preço Inicial** da moeda. A partir desse segundo, a moeda está "Listada".
4. Qualquer pessoa do mundo pode entrar na Uniswap e comprar o seu $HIVE usando o Dólar delas, ou vender o $HIVE que mineraram no app, tirando Dólar da sua piscina. 

É por isso que a "Queima" (Seção 3) é tão importante: ela garante que você estará sempre injetando o Dólar dos clientes (SaaS) nessa piscina para compensar as pessoas que estão vendendo o token minerado, fazendo o preço se manter alto.

---

## 9. Estratégia de Bootstrapping (Como lançar sem capital para Liquidez?)

É extremamente comum que fundadores não tenham $5.000 ou $10.000 Dólares para criar a Piscina de Liquidez no Dia 1. Se esse for o caso, nós usamos a estratégia de **"Fase de Pontos" (TGE Adiado)**, que é exatamente o que redes gigantes como a *Grass* fizeram.

**O Plano de Ação (Zero Capital):**

1. **Lançamento Off-Chain (Fase 1):** Você lança o aplicativo minerador, mas **ainda não lança o token na corretora**. O usuário baixa o app e começa a farmar apenas "Pontos" (Hive Points). Ele sabe que no futuro esses pontos vão virar a criptomoeda oficial. Isso já gera o hype e faz as pessoas instalarem o app.
2. **Financiamento via SaaS (Fase 2):** Ao mesmo tempo, você lança o Pilar 1 (SaaS Privado) e começa a vender os pacotes B2B em Dólar/Real via Pix e Cartão. Você guarda todo o lucro dessa operação tradicional.
3. **TGE - Token Generation Event (Fase 3):** Depois de 3 a 6 meses, quando você tiver juntado os $5.000 Dólares de lucro do seu próprio software SaaS (ou da venda de tráfego dos nós que já estão rodando), você pega esse dinheiro, vai na Uniswap, e finalmente cria a Piscina de Liquidez.
4. **O Airdrop:** Nesse mesmo dia, você libera o botão de "Saque" no painel. Os usuários que farmaram pontos por meses finalmente convertem os pontos no $HIVE real e podem vender. 

**Vantagem:** Você não tirou um centavo do próprio bolso. O próprio produto financiou o lançamento da criptomoeda, e você ainda construiu uma base de milhares de usuários (esperando o token lançar) totalmente de graça.

### A Tática de Retenção (Como não deixar a galera desistir?)
O maior risco dessa fase de espera (que pode durar meses) é o usuário desinstalar o app por achar que nunca vai ganhar nada. Para resolver isso, implementaremos duas regras de ouro no painel off-chain:

1. **Utilidade Imediata (Troca por GB):** 
   Mesmo antes do token $HIVE existir na blockchain, o usuário pode pegar os "Hive Points" acumulados e trocá-los por pacotes de GB dentro do próprio HiveNode. Isso dá utilidade real no Dia 1.
2. **Recompra Mensal Garantida (OTC Off-Chain):**
   Para manter a galera viciada, todo final de mês a HiveNode vai liberar um orçamento fixo (ex: tirar uma pequena parte do lucro do SaaS, digamos R$ 1.000 ou R$ 5.000) e avisar: *"Vamos recomprar pontos pelo preço fixo de X (ex: $0.01 por ponto, que será o preço oficial de lançamento)"*.
   - **Efeito:** Os usuários conseguem colocar dinheiro real no bolso todo mês via Pix/Dólar. 
   - **Lucro:** O sistema queima esses pontos resgatados. A empresa gasta um pouco do lucro para fidelizar a base, mas guarda a maior parte para formar a Piscina de Liquidez final. Isso cria uma confiança inabalável da comunidade no seu projeto.

---

## 10. O Quadro Geral de Valores e Porcentagens (Hard Data)

Para que o projeto saia da fase de "ideia" e vire uma regra de sistema (Whitepaper), aqui estão os valores matemáticos cravados que usaremos na programação:

### A. Distribuição da Moeda (Total Supply: 1 Bilhão de $HIVE)
- **50% (500 Milhões): Recompensas da Comunidade (Mineradores).** É o cofre que vai pagar a Persona 2 ao longo dos próximos 5 a 10 anos.
- **20% (200 Milhões): Fundadores e Equipe.** Esse é o seu patrimônio. (Regra de ouro: Fica "trancado" por 1 ano para dar segurança ao mercado, e depois vai liberando aos poucos).
- **15% (150 Milhões): Liquidez e Corretoras (DEX).** Usado para colocar na Uniswap/Raydium e fazer a moeda ter preço inicial.
- **15% (150 Milhões): Tesouraria e Marketing.** Usado para pagar influenciadores e campanhas de Airdrop.

### B. Valores do App Minerador (Off-Chain)
- **Preço Alvo do Ponto/Moeda:** $0.01 Dólar (1 Centavo de Dólar).
- **Recompensa por Uptime (Tempo Online):** 10 Pontos por Hora (Máximo de 240 Pontos/dia se ficar 24h ligado = $2.40 dólares virtuais/dia).
- **Recompensa por Tráfego Roteado:** 500 Pontos por cada 1 GB trafegado pelo celular do usuário ($5.00 dólares virtuais de bônus).
- **Sistema de Referidos (Viral):** 
  - Nível 1 (Seu amigo direto): Você ganha **10%** de tudo que ele minerar.
  - Nível 2 (Amigo do amigo): Você ganha **5%** de tudo que ele minerar.

### C. Precificação e Divisão do Lucro (O Negócio Real)
- **Preço de Venda do Proxy (Persona 3):** Fixo em **$5.00 Dólares por 1 GB**.
- **Distribuição desse faturamento:**
  - **70% ($3.50): Lucro Líquido da HiveNode.** Entra no caixa da empresa para servidores, operação e bolso do CEO.
  - **30% ($1.50): Buyback & Burn.** O sistema usa esse dinheiro para ir na corretora comprar a moeda e queimá-la (fazendo o preço do $HIVE subir).

### D. Taxa do Smart Contract (Transação P2P)
Sempre que alguém transferir a moeda pela blockchain (depois do TGE), haverá uma **Taxa de 4%**:
- **2% para Auto-Queima (Burn):** Reduz o supply eternamente.
- **2% para a Tesouraria Administrativa:** Lucro passivo extra para a empresa.
