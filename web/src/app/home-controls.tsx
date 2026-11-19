"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Hexagon, Menu, X } from "lucide-react";
import styles from "./sales.module.css";

const homeLinks = [
  ["#plataforma", "Plataforma"],
  ["#laboratorio", "Laboratório"],
  ["#planos", "Planos"],
  ["#perguntas", "Ajuda"],
];

export function HomeNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={`${styles.shell} ${styles.nav}`} onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          document.getElementById("home-menu-button")?.focus();
        }
      }}>
        <a className={styles.brand} href="#inicio" aria-label="HiveNode, início" onClick={() => setOpen(false)}>
          <Hexagon size={29} strokeWidth={2.3} aria-hidden /> HiveNode<span>.</span>
        </a>
        <nav className={styles.navLinks} data-open={open} id="home-navigation" aria-label="Navegação principal">
          {homeLinks.map(([href, label]) => <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}
        </nav>
        <Link className={styles.account} href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Abrir painel" : "Entrar"}</Link>
        <button className={styles.menuButton} id="home-menu-button" type="button" aria-controls="home-navigation" aria-expanded={open} aria-label={open ? "Fechar menu" : "Abrir menu"} onClick={() => setOpen(!open)}>
          {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
      </div>
    </header>
  );
}

type PublicPlan = {
  id: string;
  name: string;
  priceInCents: number;
  maxDevices: number;
  maxProxies: number;
  gbIncluded: number;
  privateFleet: boolean;
  checkout: boolean;
  period: string;
  href: string;
};

const formatPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const capacityLabel = (limit: number, single: string, plural: string) =>
  limit ? `${limit} ${limit === 1 ? single : plural}` : `${plural[0].toUpperCase()}${plural.slice(1)} ilimitados`;
const enough = (limit: number, required: number) => limit === 0 || limit >= required;

export function PlanExplorer({ plans, contactHref }: { plans: PublicPlan[]; contactHref: string }) {
  const [devices, setDevices] = useState("1");
  const [proxies, setProxies] = useState("1");
  const [view, setView] = useState<"fleet" | "traffic">(plans.some((plan) => plan.privateFleet) ? "fleet" : "traffic");
  const fleets = plans.filter((plan) => plan.privateFleet);
  const traffic = plans.filter((plan) => !plan.privateFleet);
  const validSize = [devices, proxies].every((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 9999);
  const match = validSize ? fleets.find((plan) => enough(plan.maxDevices, Number(devices)) && enough(plan.maxProxies, Number(proxies))) : undefined;

  if (plans.length === 0) {
    return <div className={styles.empty}><p>Consulte a equipe para confirmar preços e disponibilidade.</p><a className={styles.primary} href={contactHref}>Consultar planos</a></div>;
  }

  return (
    <>
      {fleets.length > 0 && traffic.length > 0 && (
        <div className={styles.planSwitch} role="group" aria-label="Tipo de plano">
          <button type="button" aria-pressed={view === "fleet"} onClick={() => setView("fleet")}>Frota privada</button>
          <button type="button" aria-pressed={view === "traffic"} onClick={() => setView("traffic")}>Pacotes de tráfego</button>
        </div>
      )}
      {view === "fleet" && (
        <div className={styles.planPicker}>
          <label>Aparelhos<input type="number" min={1} max={9999} step={1} value={devices} onChange={(event) => setDevices(event.target.value)} /></label>
          <label>Proxies<input type="number" min={1} max={9999} step={1} value={proxies} onChange={(event) => setProxies(event.target.value)} /></label>
          <p role="status">
            {match ? <>Indicado para sua frota <strong>{match.name}</strong></> : validSize ? <>Frota acima dos limites do catálogo <a href={contactHref}>Fale com a equipe</a></> : <>Informe quantidades inteiras entre 1 e 9.999.</>}
          </p>
        </div>
      )}
      <div className={styles.plans}>
        {(view === "fleet" ? fleets : traffic).map((plan) => (
          <article className={styles.plan} data-match={match?.id === plan.id} key={plan.id}>
            <div className={styles.planHeading}>
              <h3>{plan.name}</h3>
              {match?.id === plan.id && <span><Check size={15} aria-hidden /> Indicado</span>}
            </div>
            <p className={styles.price}>{formatPrice.format(plan.priceInCents / 100)}<small>{plan.period}</small></p>
            <ul>
              {plan.privateFleet ? (
                <>
                  <li><Check size={17} aria-hidden />{capacityLabel(plan.maxDevices, "aparelho", "aparelhos")}</li>
                  <li><Check size={17} aria-hidden />{capacityLabel(plan.maxProxies, "proxy", "proxies")}</li>
                </>
              ) : <li><Check size={17} aria-hidden />{plan.gbIncluded} GB de tráfego incluído</li>}
            </ul>
            {plan.checkout ? (
              <Link className={styles.primary} href={plan.href} aria-label={`Contratar ${plan.name}`}>Contratar plano</Link>
            ) : (
              <a className={match?.id === plan.id ? styles.primary : styles.outline} href={plan.href} aria-label={`Consultar contratação do ${plan.name}`}>Consultar contratação</a>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
