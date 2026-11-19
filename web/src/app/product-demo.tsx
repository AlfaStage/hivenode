"use client";

import { useEffect, useState } from "react";
import { Cable, Check, Hexagon, Laptop, MessageSquare, Play, Radio, Smartphone, Wifi } from "lucide-react";
import styles from "./sales.module.css";

const channels = [
  { id: "proxy", label: "Proxy móvel", icon: Cable },
  { id: "sms", label: "HiveNode SMS", icon: MessageSquare },
] as const;

const proxySteps = [
  { icon: Smartphone, title: "Seu Android", description: "Fornece a conexão do aparelho" },
  { icon: Hexagon, title: "HiveNode", description: "Autentica o acesso ao proxy" },
  { icon: Laptop, title: "Seu software", description: "Usa o endpoint SOCKS5" },
];

const smsSteps = [
  { icon: Laptop, title: "Painel ou API", description: "Recebe um envio consentido" },
  { icon: Smartphone, title: "Android com seu chip", description: "Encaminha à operadora" },
  { icon: MessageSquare, title: "Acompanhamento", description: "Mostra o status do envio" },
];

const initialMessage = "Seu pedido saiu para entrega. Acompanhe pelo link que você recebeu por e-mail.";

export function ProductDemo() {
  const [channel, setChannel] = useState<"proxy" | "sms">("proxy");
  const [medium, setMedium] = useState<"mobile" | "wifi">("mobile");
  const [message, setMessage] = useState(initialMessage);
  const [phase, setPhase] = useState(0);
  const steps = channel === "proxy" ? proxySteps : smsSteps;
  const running = phase > 0 && phase <= steps.length;
  const done = phase > steps.length;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setPhase((current) => current + 1), 580);
    return () => window.clearTimeout(timer);
  }, [phase, running]);

  const status = done ? "Simulação concluída" : running ? `Etapa ${phase} de ${steps.length}` : "Pronto para simular";

  return (
    <div className={styles.lab}>
      <div className={styles.labHead}>
        <div className={styles.labTabs} role="group" aria-label="Cenário da simulação">
          {channels.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={id === channel} onClick={() => {
              if (channel !== id) {
                setPhase(0);
                setChannel(id);
              }
            }}><Icon size={18} aria-hidden /> {label}</button>
          ))}
        </div>
        <span className={styles.labTag}>{channel === "proxy" ? "SOCKS5 / SOCKS5h" : "Módulo em desenvolvimento"}</span>
      </div>
      <div className={styles.labBody}>
        <div className={styles.labSettings}>
          {channel === "proxy" ? (
            <fieldset>
              <legend>Conexão do Android</legend>
              <label><input type="radio" name="hive-network-medium" checked={medium === "mobile"} onChange={() => { setMedium("mobile"); setPhase(0); }} /><Radio size={18} aria-hidden /> Dados móveis</label>
              <label><input type="radio" name="hive-network-medium" checked={medium === "wifi"} onChange={() => { setMedium("wifi"); setPhase(0); }} /><Wifi size={18} aria-hidden /> Wi-Fi</label>
            </fieldset>
          ) : (
            <label className={styles.compose}>
              Mensagem de exemplo
              <textarea maxLength={160} rows={3} value={message} onChange={(event) => { setMessage(event.target.value); setPhase(0); }} />
              <small>{message.length}/160 caracteres no simulador</small>
            </label>
          )}
          <button className={styles.primary} type="button" disabled={running || (channel === "sms" && !message.trim())} onClick={() => setPhase(1)}>
            <Play size={17} aria-hidden /> {done ? "Simular de novo" : running ? "Simulando…" : "Iniciar simulação"}
          </button>
        </div>
        <div className={styles.topology}>
          <ol className={styles.route}>
            {steps.map(({ icon: Icon, title, description }, index) => {
              const progress = phase > index + 1 ? "complete" : phase === index + 1 ? "active" : "idle";
              return (
                <li key={title} data-progress={progress} aria-current={progress === "active" ? "step" : undefined}>
                  <span className={styles.node}><Icon size={26} aria-hidden /></span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </li>
              );
            })}
          </ol>
          <div className={styles.routeStatus} role="status">
            {done ? <Check size={17} aria-hidden /> : <span aria-hidden />}
            <strong>{status}</strong>
            {channel === "proxy" && <small>{medium === "wifi" ? "Wi-Fi" : "Dados móveis"}</small>}
          </div>
          {channel === "sms" && done && (
            <p className={styles.delivered}><MessageSquare size={17} aria-hidden /><span><strong>Prévia da mensagem</strong>{message}</span></p>
          )}
        </div>
      </div>
    </div>
  );
}
