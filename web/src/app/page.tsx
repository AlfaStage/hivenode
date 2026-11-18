import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronDown, Hexagon, Layers, MessageSquare, Network, Smartphone, Terminal } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { ProductDemo } from "./product-demo";
import styles from "./sales.module.css";

const description = "Transforme seus aparelhos Android em uma frota de proxies SOCKS5. Compare os planos do HiveNode e conheça o HiveNode SMS.";

export const metadata: Metadata = {
  title: "Proxy móvel para sua operação",
  description,
  alternates: { canonical: "/" },
  metadataBase: new URL("https://hivenode.alfastage.com.br"),
  openGraph: { title: "HiveNode | Proxy móvel para sua operação", description, locale: "pt_BR", type: "website" },
};

const email = "hivenode@alfastage.com.br";
const contact = (subject: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}`;
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function loadPlans() {
  try {
    const { prisma } = await import("@/lib/prisma");
    return await prisma.plan.findMany({
      where: { isPublic: true, isAdminOnly: false, category: { in: ["PRIVATE_FLEET", "GLOBAL_FLEET"] } },
      orderBy: [{ category: "asc" }, { priceInCents: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, category: true, priceInCents: true, maxDevices: true,
        maxProxies: true, gbIncluded: true, billingCycle: true, isRecurring: true, abacateProductId: true,
      },
    });
  } catch (error) {
    console.error("[Sales] Falha ao carregar o catálogo público", error);
    return [];
  }
}

const workflow = [
  { icon: Smartphone, title: "Conecte seus Androids", description: "Instale o app HiveNode e vincule seus aparelhos à conta pelo painel." },
  { icon: Network, title: "Crie seus proxies", description: "Selecione um aparelho conectado e gere as credenciais do endpoint SOCKS5." },
  { icon: Terminal, title: "Use na sua operação", description: "Configure o endpoint no seu software e acompanhe a frota pelo painel." },
];

const questions = [
  ["Preciso de um aparelho Android?", "Para montar sua frota privada, sim. O app HiveNode usa a conexão Wi-Fi ou de dados móveis do aparelho para operar como nó de proxy."],
  ["Meu software é compatível?", "Use um cliente com suporte a SOCKS5 e autenticação por usuário e senha. Quando o cliente oferecer SOCKS5h, a resolução DNS acontece pelo proxy."],
  ["O que muda de um plano para outro?", "Na frota privada, os planos definem quantos aparelhos e proxies você pode gerenciar. Pacotes por tráfego, quando disponíveis, são vendidos em GB."],
  ["Já posso contratar o HiveNode SMS?", "O módulo está em desenvolvimento. Escreva para a equipe se quiser conversar sobre o lançamento. A proposta usa as linhas da sua própria operação em aparelhos Android compatíveis."],
];

export default async function HomePage() {
  const [user, plans] = await Promise.all([getAuthenticatedUser(), loadPlans()]);
  const gatewayConfigured = plans.some((plan) => plan.abacateProductId)
    && await (await import("@/lib/abacatepay")).isBillingConfigured();
  const billingHref = user ? "/dashboard/billing" : "/register?origem=planos";

  return (
    <div className={styles.sales} id="inicio">
      <header className={styles.header}>
        <div className={styles.nav}>
          <a className={styles.brand} href="#inicio" aria-label="HiveNode, início">
            <span className={styles.brandIcon}><Hexagon size={23} strokeWidth={2.4} aria-hidden /><i /></span>
            HiveNode
          </a>
          <nav className={styles.navLinks} aria-label="Navegação principal">
            <a href="#proxy">Como funciona</a>
            <a href="#sms">SMS</a>
            <a href="#planos">Planos</a>
          </nav>
          <Link className={styles.navAccount} href={user ? "/dashboard" : "/login"}>{user ? "Abrir painel" : "Entrar"}</Link>
          <a className={styles.navCta} href="#planos">Ver planos</a>
        </div>
      </header>
      <main>
        <section className={styles.hero} aria-labelledby="sales-title">
          <div className={styles.heroBackdrop} aria-hidden />
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}><span /> INFRAESTRUTURA DE REDE</p>
              <h1 id="sales-title">Proxy móvel.<br /><em>Do seu jeito.</em></h1>
              <p className={styles.lead}>Transforme seus aparelhos Android em uma frota de proxies SOCKS5. Gere acessos e gerencie as conexões da sua operação em um só painel.</p>
              <div className={styles.buttons}>
                <a className={styles.primaryButton} href="#planos">Ver planos de proxy</a>
                <a className={styles.secondaryButton} href="#proxy">Como funciona</a>
              </div>
            </div>
            <ProductDemo />
          </div>
        </section>

        <section className={styles.workflow} id="proxy" aria-labelledby="proxy-title">
          <div className={styles.shell}>
            <p className={styles.kicker}>PROXY SOCKS5</p>
            <h2 id="proxy-title">Do Android ao seu software.</h2>
            <div className={styles.steps}>
              {workflow.map(({ icon: Icon, title, description }) => (
                <article className={styles.step} key={title}>
                  <span className={styles.stepIcon}><Icon size={23} aria-hidden /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.shell} id="sms" aria-labelledby="sms-title">
          <div className={styles.sms}>
            <div>
              <p className={styles.kicker}>HIVENODE SMS · EM DESENVOLVIMENTO</p>
              <h2 id="sms-title">O próximo passo é enviar SMS com suas próprias linhas.</h2>
              <p>O HiveNode SMS foi pensado para gerenciar envios consentidos pelo painel e pela API, usando seus aparelhos Android e os chips da sua operação.</p>
              <a className={styles.secondaryButton} href={contact("Interesse no HiveNode SMS")}>Tenho interesse em SMS</a>
            </div>
            <div className={styles.smsPreview}>
              <header><MessageSquare size={20} aria-hidden /> Exemplo de mensagem</header>
              <p>Seu pedido saiu para entrega. Acompanhe pelo link que você recebeu por e-mail.</p>
              <small>Exemplo ilustrativo · nenhum envio é realizado aqui</small>
            </div>
          </div>
        </section>

        <section className={styles.section} id="planos" aria-labelledby="plans-title">
          <div className={styles.shell}>
            <p className={styles.kicker}>PLANOS DE PROXY</p>
            <h2 id="plans-title">Escolha o tamanho da sua operação.</h2>
            <p className={styles.sectionLead}>Compare os preços e os limites do catálogo HiveNode.</p>
            {plans.length ? (
              <div className={styles.plans}>
                {plans.map((plan) => {
                  const isPrivate = plan.category === "PRIVATE_FLEET";
                  const checkoutAvailable = Boolean(plan.abacateProductId && gatewayConfigured);
                  const period = plan.isRecurring ? (plan.billingCycle === "YEARLY" ? "por ano" : "por mês") : "pagamento único";

                  return (
                    <article className={styles.plan} key={plan.id}>
                      <div className={styles.planType}><Layers size={17} aria-hidden />{isPrivate ? "Frota privada" : "Pacote de tráfego"}</div>
                      <h3>{plan.name}</h3>
                      <p className={styles.price}>{currency.format(plan.priceInCents / 100)}<small>{period}</small></p>
                      <ul>
                        {isPrivate ? (
                          <>
                            <li><Check size={18} aria-hidden />{plan.maxDevices ? `${plan.maxDevices} ${plan.maxDevices === 1 ? "aparelho" : "aparelhos"}` : "Aparelhos ilimitados"}</li>
                            <li><Check size={18} aria-hidden />{plan.maxProxies ? `${plan.maxProxies} ${plan.maxProxies === 1 ? "proxy" : "proxies"}` : "Proxies ilimitados"}</li>
                          </>
                        ) : <li><Check size={18} aria-hidden />{plan.gbIncluded} GB de tráfego incluído</li>}
                      </ul>
                      {checkoutAvailable ? (
                        <Link className={styles.primaryButton} href={billingHref} aria-label={`Contratar ${plan.name}`}>Contratar plano</Link>
                      ) : (
                        <a className={styles.secondaryButton} href={contact(`Contratação HiveNode — ${plan.name}`)} aria-label={`Consultar contratação do ${plan.name}`}>Consultar contratação</a>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.empty}>
                <p>Consulte a equipe para confirmar preços, disponibilidade e contratação.</p>
                <a className={styles.primaryButton} href={contact("Planos de proxy HiveNode")}>Consultar planos</a>
              </div>
            )}
          </div>
        </section>

        <section className={styles.faq} id="perguntas" aria-labelledby="faq-title">
          <div className={styles.shell}>
            <p className={styles.kicker}>PERGUNTAS FREQUENTES</p>
            <h2 id="faq-title">Antes de começar.</h2>
            <div className={styles.questions}>
              {questions.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}<ChevronDown size={19} aria-hidden /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.shell}>
          <a className={styles.brand} href="#inicio"><Hexagon size={21} aria-hidden /> HiveNode</a>
          <nav aria-label="Rodapé">
            <a href={contact("Contato HiveNode")}>Contato</a>
            <Link href="/beta">Interesse no beta Hive Miner</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
