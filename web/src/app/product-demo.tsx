"use client";

import { useState } from "react";
import { Check, Laptop, MessageSquare, Network, Smartphone } from "lucide-react";
import styles from "./sales.module.css";

const channels = {
  proxy: {
    label: "Proxy móvel",
    icon: Network,
    rows: [
      { icon: Smartphone, title: "Android da sua frota", description: "Conexão móvel ou Wi-Fi" },
      { icon: Network, title: "Endpoint SOCKS5", description: "Acesso com usuário e senha" },
      { icon: Laptop, title: "Seu software", description: "Conectado pelo endpoint" },
    ],
  },
  sms: {
    label: "HiveNode SMS",
    icon: MessageSquare,
    rows: [
      { icon: Laptop, title: "Painel ou API", description: "Registre um envio consentido" },
      { icon: Smartphone, title: "Android com seu chip", description: "Envio previsto pela sua operadora" },
      { icon: MessageSquare, title: "Status no painel", description: "Acompanhe o resultado do envio" },
    ],
  },
} as const;

export function ProductDemo() {
  const [channel, setChannel] = useState<keyof typeof channels>("proxy");

  return (
    <div className={styles.demo}>
      <div className={styles.demoHeader}><span><span aria-hidden /> Fluxo de conexão</span><small>Demonstração</small></div>
      <div className={styles.demoButtons} role="group" aria-label="Escolha o fluxo da demonstração">
        {(Object.keys(channels) as Array<keyof typeof channels>).map((key) => {
          const { icon: Icon, label } = channels[key];
          return <button key={key} type="button" aria-pressed={key === channel} onClick={() => setChannel(key)}><Icon size={17} aria-hidden />{label}</button>;
        })}
      </div>
      <ul className={styles.demoRows} aria-live="polite">
        {channels[channel].rows.map(({ icon: Icon, title, description }) => (
          <li key={title}>
            <span className={styles.demoIcon}><Icon size={21} aria-hidden /></span>
            <span><strong>{title}</strong><small>{description}</small></span>
            <Check className={styles.demoCheck} size={17} aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}
