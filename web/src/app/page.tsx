import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Cable, ChevronDown, Hexagon, MessageSquare, Network, Radio, ShieldCheck, Smartphone } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { HomeNav, PlanExplorer } from "./home-controls";
import { ProductDemo } from "./product-demo";
import styles from "./sales.module.css";

const description = "Monte uma frota de proxies SOCKS5 com seus próprios Androids. Explore a plataforma HiveNode, compare planos e conheça a proposta do HiveNode SMS.";

export const metadata: Metadata = {
  title: "Sua rede, do seu jeito",
  description,
  alternates: { canonical: "/" },
  metadataBase: new URL("https://hivenode.alfastage.com.br"),
  openGraph: {
    title: "HiveNode | Sua rede, do seu jeito",
    description,
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/hive-network.webp", width: 1440, height: 960, alt: "Android conectado a um nó de rede HiveNode" }],
  },
};

const contact = (subject: string) => `mailto:hivenode@alfastage.com.br?subject=${encodeURIComponent(subject)}`;

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
    console.error("[Home] Falha ao carregar o catálogo público", error);
    return [];
  }
}

const questions = [
  ["Preciso de um aparelho Android?", "Para montar sua frota privada, sim. O app HiveNode usa o Wi-Fi ou os dados móveis do aparelho para operar como nó de proxy."],
  ["Como meu software se conecta ao HiveNode?", "Configure o host, a porta e as credenciais geradas no painel em um cliente SOCKS5. Se o cliente oferecer SOCKS5h, a resolução DNS pode acontecer pelo proxy."],
  ["Como escolho um plano?", "Informe quantos aparelhos e proxies você pretende operar. O seletor mostra a opção de menor preço com capacidade suficiente no catálogo público."],
  ["Já posso contratar o HiveNode SMS?", "O módulo está em desenvolvimento. A proposta usa os chips da sua operação em Androids compatíveis. Fale com a equipe para compartilhar seu caso de uso."],
];

export default async function HomePage() {
  const [user, plans] = await Promise.all([getAuthenticatedUser(), loadPlans()]);
  const gatewayConfigured = plans.some((plan) => plan.abacateProductId)
    && await (await import("@/lib/abacatepay")).isBillingConfigured();
  const billingHref = user ? "/dashboard/billing" : "/register?origem=planos";
  const catalog = plans.map(({ id, name, category, priceInCents, maxDevices, maxProxies, gbIncluded, billingCycle, isRecurring, abacateProductId }) => {
    const checkout = Boolean(abacateProductId && gatewayConfigured);
    return {
      id, name, priceInCents, maxDevices, maxProxies, gbIncluded, checkout,
      privateFleet: category === "PRIVATE_FLEET",
      period: isRecurring ? (billingCycle === "YEARLY" ? "por ano" : "por mês") : "pagamento único",
      href: checkout ? billingHref : contact(`Contratação HiveNode — ${name}`),
    };
  });

  return (
    <div className={styles.sales} id="inicio">
      <a href="#conteudo" className={styles.skipLink}>Pular para o conteúdo</a>
      <HomeNav signedIn={Boolean(user)} />
      <main id="conteudo" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="sales-title">
          <div className={styles.heroArt} aria-hidden="true">
            <Image src="/hive-network.webp" alt="" fill preload unoptimized sizes="(max-width: 760px) 100vw, 75vw" />
          </div>
          <div className={`${styles.shell} ${styles.heroContent}`}>
            <p className={styles.eyebrow}><Radio size={16} aria-hidden /> INFRAESTRUTURA MÓVEL</p>
            <h1 id="sales-title">Sua rede.<br /> <em>Do seu jeito.</em></h1>
            <p className={styles.lead}>Transforme seus Androids em uma frota de proxies SOCKS5. Controle os aparelhos, os acessos e por onde sua operação se conecta.</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="#laboratorio">Experimentar a rede</a>
              <a className={styles.outline} href="#planos">Explorar planos</a>
            </div>
          </div>
          <div className={styles.heroRail}>
            <div className={styles.shell}>
              <span><Smartphone size={19} aria-hidden /> Seus aparelhos Android</span>
              <span><Cable size={19} aria-hidden /> Proxies SOCKS5 e SOCKS5h</span>
              <span><ShieldCheck size={19} aria-hidden /> Acessos no seu painel</span>
            </div>
          </div>
        </section>

        <section className={styles.light} id="plataforma" aria-labelledby="platform-title">
          <div className={`${styles.shell} ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>A PLATAFORMA</p>
                <h2 id="platform-title">Tudo começa<br /> no seu Android.</h2>
              </div>
              <p className={styles.sectionIntro}>Use a conexão dos seus aparelhos para operar proxies. O HiveNode SMS estende essa ideia às linhas da sua própria operação.</p>
            </div>
            <div className={styles.products}>
              <article className={`${styles.product} ${styles.proxyProduct}`} id="proxy">
                <Network className={styles.productIcon} size={28} aria-hidden />
                <h3>Proxy móvel</h3>
                <p>Vincule aparelhos pelo painel, gere as credenciais e configure o endpoint SOCKS5 no seu software.</p>
                <a className={styles.textLink} href="#laboratorio">Testar o fluxo de proxy</a>
                <div className={styles.miniTopology} aria-hidden="true">
                  <span><Smartphone size={24} /></span><i /><span><Hexagon size={28} /></span><i /><span><Cable size={24} /></span>
                </div>
              </article>
              <article className={`${styles.product} ${styles.smsProduct}`} id="sms">
                <div className={styles.productTop}><MessageSquare className={styles.productIcon} size={28} aria-hidden /><span>Em desenvolvimento</span></div>
                <h3>HiveNode SMS</h3>
                <p>Envios consentidos pelo painel e pela API, usando os chips da sua operação. Veja como esse fluxo foi pensado.</p>
                <a className={styles.textLink} href={contact("Interesse no HiveNode SMS")}>Tenho interesse em SMS</a>
                <div className={styles.miniMessage} aria-hidden="true"><MessageSquare size={17} /> Seu pedido saiu para entrega.</div>
              </article>
            </div>
          </div>
        </section>

        <section className={`${styles.shell} ${styles.section} ${styles.labSection}`} id="laboratorio" aria-labelledby="lab-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>LABORATÓRIO INTERATIVO</p>
              <h2 id="lab-title">Siga o caminho<br /> da conexão.</h2>
            </div>
            <p className={styles.sectionIntro}>Escolha um cenário e acompanhe cada etapa da simulação. Nenhuma conexão ou mensagem real sai daqui.</p>
          </div>
          <ProductDemo />
        </section>

        <section className={styles.light} id="planos" aria-labelledby="plans-title">
          <div className={`${styles.shell} ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>CATÁLOGO DE PROXY</p>
                <h2 id="plans-title">Encontre seu plano.</h2>
              </div>
              <p className={styles.sectionIntro}>Informe o tamanho da sua frota ou compare os planos e pacotes disponíveis agora.</p>
            </div>
            <PlanExplorer plans={catalog} contactHref={contact("Planos de proxy HiveNode")} />
          </div>
        </section>

        <section className={`${styles.shell} ${styles.section} ${styles.faq}`} id="perguntas" aria-labelledby="faq-title">
          <div>
            <p className={styles.eyebrow}>CENTRAL DE AJUDA</p>
            <h2 id="faq-title">Ainda ficou<br /> alguma dúvida?</h2>
            <a className={styles.textLink} href={contact("Contato HiveNode")}>Falar com a equipe</a>
          </div>
          <div className={styles.questions}>
            {questions.map(([question, answer]) => (
              <details key={question} name="hivenode-faq">
                <summary>{question}<ChevronDown size={20} aria-hidden /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerContent}`}>
          <div>
            <a className={styles.brand} href="#inicio"><Hexagon size={25} aria-hidden /> HiveNode<span>.</span></a>
            <p>Infraestrutura móvel para sua operação.</p>
          </div>
          <nav aria-label="Produtos">
            <a href="#proxy">Proxy móvel</a>
            <a href="#sms">HiveNode SMS</a>
            <a href="#planos">Planos</a>
          </nav>
          <nav aria-label="Conta e contato">
            <Link href={user ? "/dashboard" : "/login"}>{user ? "Abrir painel" : "Entrar na conta"}</Link>
            <a href={contact("Contato HiveNode")}>Contato</a>
            <Link href="/beta">Interesse no beta Hive Miner</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
