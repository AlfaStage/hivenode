"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Binding = { id: string; slot: number; label: string };
type Device = {
  id: string; label: string; bindings: Binding[]; lastSeenAt: string | null;
  selectedBinding: string | null; approvedBinding: string | null; pendingBinding: string | null;
  destinationMask: string | null;
};
type Message = {
  id: string; maskedDestination: string; state: string; createdAt: string;
  sentParts: number; deliveredParts: number; failedParts: number; totalParts: number; errorCode: string | null;
};
type Overview = { devices: Device[]; key: { id: string } | null; realSendEnabled: boolean; consentVersion: string };
type Pending = Pick<Device, "id" | "label" | "pendingBinding" | "destinationMask" | "bindings"> & {
  user: { email: string }; approvalToken: string;
};

const pilot = "/api/sms/pilot";
const states: Record<string, string> = {
  QUEUED: "Na fila", AUTHORIZED: "Autorizado no aparelho", SENT: "Enviado pelo Android",
  DELIVERED: "Entrega confirmada", PARTIAL: "Envio parcial", FAILED: "Falhou",
  UNKNOWN: "Resultado desconhecido", CANCELED: "Cancelado", EXPIRED: "Fila expirada",
};
const diagnoses: Record<string, string> = {
  PERMISSION_REQUIRED: "Confira a permissão SMS nas configurações do Android.",
  SIM_UNAVAILABLE: "Confira o chip selecionado e refaça a autorização se o chip mudou.",
  RADIO_OFF: "Desative o modo avião e confira a rede móvel.",
  NO_SERVICE: "Confira a cobertura móvel da linha.",
  NETWORK_REJECTED: "A rede recusou o envio. Consulte a operadora antes de tentar de novo.",
  PLATFORM_LIMIT: "O Android restringiu o envio. Aguarde e confira os limites da linha.",
  PREMIUM_BLOCKED: "O Android bloqueou este destino. Revise a configuração do destinatário.",
  MODEM_ERROR: "O Android registrou uma falha. Confira a linha e o aparelho.",
  MESSAGE_TOO_LONG: "O Android calculou mais de três partes. Encurte a mensagem.",
  INVOCATION_UNCERTAIN: "Confira o histórico do celular e o recebimento antes de criar outro envio.",
  CALLBACK_TIMEOUT: "O aparelho não informou o resultado a tempo. Confira o histórico antes de enviar de novo.",
  QUEUE_EXPIRED: "A mensagem expirou enquanto aguardava o aparelho.",
};

async function call<T>(path: string, options?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", ...options });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Não foi possível acessar o serviço.");
  return json.data as T;
}

export function SmsPilotPanel({ administrator }: { administrator: boolean }) {
  const [overview, setOverview] = useState<Overview>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [pair, setPair] = useState<{ code: string; expiresAt: string }>();
  const [apiToken, setApiToken] = useState("");
  const [number, setNumber] = useState("");
  const [body, setBody] = useState("");
  const [verified, setVerified] = useState(false);
  const [reviewedDevice, setReviewedDevice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(0);
  const nextKey = useRef("");

  const refresh = useCallback(async () => {
    const [info, results, approvals] = await Promise.all([
      call<Overview>(pilot), call<{ messages: Message[] }>(pilot + "/messages"),
      administrator ? call<{ pending: Pending[] }>(pilot + "/admin") : Promise.resolve({ pending: [] }),
    ]);
    setOverview(info);
    setMessages(results.messages);
    setPending(approvals.pending);
    setRefreshedAt(Date.now());
    if (info.devices.length) setPair(undefined);
  }, [administrator]);

  useEffect(() => {
    async function load() {
      try { await refresh(); } catch (error) { setFeedback((error as Error).message); }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function mutate(task: () => Promise<void>) {
    setBusy(true);
    setFeedback("");
    try {
      await task();
      await refresh();
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function write<T>(path: string, payload: object, method = "POST", key?: string) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (key) headers["idempotency-key"] = key;
    return call<T>(path, { method, headers, body: JSON.stringify(payload) });
  }

  const device = overview?.devices[0];
  const line = device?.bindings.find(binding => binding.id === device.selectedBinding);
  const online = device?.lastSeenAt && refreshedAt - Date.parse(device.lastSeenAt) < 90_000;
  const pairValid = pair && refreshedAt < Date.parse(pair.expiresAt);
  const buttonDisabled = busy || !overview;

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!device) return;
    nextKey.current ||= crypto.randomUUID();
    void mutate(async () => {
      await write(pilot + "/messages", { deviceId: device.id, destination: number, text: body }, "POST", nextKey.current);
      nextKey.current = "";
      setBody("");
      setFeedback("Mensagem na fila. Acompanhe a resposta do Android abaixo.");
    });
  }

  return (
    <div className="grid gap-4">
      {overview && !overview.realSendEnabled && <p className="text-sm text-muted-foreground">Envio real pausado pela operação.</p>}
      <p aria-live="polite" className="text-sm">{feedback}</p>
      <Card><CardHeader><CardTitle>Aparelho e chip</CardTitle></CardHeader><CardContent className="grid gap-3">
        {!device ? <>
          <p className="text-sm text-muted-foreground">Abra SMS no app HiveNode para ler o código de vínculo.</p>
          <Button className="w-fit" disabled={buttonDisabled} onClick={() => void mutate(async () => setPair(await write(pilot, { action: "pair" })))}>
            Gerar código de vínculo
          </Button>
          {pairValid && <div className="grid gap-2">
            <div className="w-fit rounded bg-white p-3"><QRCode value={pair.code} size={156} title="Código de vínculo do SMS" /></div>
            <Input aria-label="Código de vínculo" value={pair.code} readOnly />
            <Button className="w-fit" variant="outline" onClick={() => void navigator.clipboard.writeText(pair.code)}>Copiar código</Button>
          </div>}
        </> : <>
          <p className="text-sm">{device.label} · {online ? "App conectado" : "Abra o app no aparelho"}</p>
          <ul className="grid gap-1 text-sm">{device.bindings.map(binding => <li key={binding.id}>SIM {binding.slot + 1} · {binding.label}{binding.id === device.selectedBinding ? " · selecionado no app" : ""}</li>)}</ul>
          {device.approvedBinding && <p className="text-sm">Linha aprovada. Destino de teste {device.destinationMask}.</p>}
          {device.pendingBinding && <p className="text-sm">Solicitação de {device.destinationMask} aguardando revisão.</p>}
          <div className="grid gap-2">
            <label className="grid gap-1 text-sm">Número de teste com DDI
              <Input type="tel" placeholder="+5562999999999" value={number} onChange={event => { setNumber(event.target.value); nextKey.current = ""; }} />
            </label>
            {line && !device.approvedBinding && <label className="flex items-start gap-2 text-sm">
              <input className="mt-1" type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} />
              Confirmo que controlo este número de teste e que solicitei à operadora autorização para este uso da linha.
            </label>}
          </div>
          <div className="flex flex-wrap gap-2">
            {line && !device.approvedBinding && <Button disabled={buttonDisabled || !verified || !online || !number} onClick={() => void mutate(async () => {
              await write(pilot, { action: "request-approval", deviceId: device.id, bindingId: line.id,
                destination: number, verifiedByOwner: true, consentVersion: overview?.consentVersion });
            })}>Solicitar aprovação</Button>}
            <Button variant="outline" disabled={buttonDisabled} onClick={() => void mutate(async () => { await write(pilot, { action: "revoke-device", deviceId: device.id }); })}>Desvincular aparelho</Button>
          </div>
        </>}
      </CardContent></Card>
      {administrator && pending.length > 0 && <Card><CardHeader><CardTitle>Revisão administrativa</CardTitle></CardHeader><CardContent className="grid gap-4">
        {pending.map(item => <div key={item.id} className="grid gap-2 border-b pb-3 text-sm">
          <p>{item.user.email} · {item.label} · {item.bindings.find(binding => binding.id === item.pendingBinding)?.label} · {item.destinationMask}</p>
          <label className="flex gap-2"><input type="checkbox" checked={reviewedDevice === item.approvalToken}
            onChange={event => setReviewedDevice(event.target.checked ? item.approvalToken : "")} /> Conferi a elegibilidade do plano desta linha.</label>
          <div className="flex gap-2">
            <Button disabled={busy || reviewedDevice !== item.approvalToken} onClick={() => void mutate(async () => {
              await write(pilot + "/admin", { deviceId: item.id, bindingId: item.pendingBinding, action: "approve",
                approvalToken: item.approvalToken, carrierReviewed: true });
              setReviewedDevice("");
            })}>Aprovar linha</Button>
            <Button variant="outline" disabled={busy} onClick={() => void mutate(async () => {
              await write(pilot + "/admin", { deviceId: item.id, bindingId: item.pendingBinding, action: "decline",
                approvalToken: item.approvalToken });
            })}>Recusar</Button>
          </div>
        </div>)}
      </CardContent></Card>}
      {device?.approvedBinding && <Card><CardHeader><CardTitle>Enviar SMS</CardTitle></CardHeader><CardContent>
        <form onSubmit={send} className="grid gap-3">
          <p className="text-sm text-muted-foreground">O envio usa a linha aprovada e pode consumir a franquia da operadora.</p>
          <label className="grid gap-1 text-sm" htmlFor="sms-pilot-body">Mensagem</label>
          <textarea id="sms-pilot-body" rows={3} maxLength={420} required value={body}
            onChange={event => { setBody(event.target.value); nextKey.current = ""; }}
            className="w-full rounded-md border bg-transparent p-2 text-sm" />
          <Button className="w-fit" disabled={busy || !overview?.realSendEnabled || !number || !body.trim()}>Colocar na fila de envio</Button>
        </form>
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Histórico</CardTitle></CardHeader><CardContent className="grid gap-3">
        {!messages.length && <p className="text-sm text-muted-foreground">Nenhum envio real registrado.</p>}
        {messages.map(message => <div key={message.id} className="grid gap-1 border-b pb-2 text-sm">
          <p>{states[message.state] || message.state} · {message.maskedDestination} · {new Date(message.createdAt).toLocaleString("pt-BR")}</p>
          <p className="font-mono text-xs break-all">{message.id}</p>
          {message.totalParts > 0 && <p>{message.sentParts}/{message.totalParts} enviadas · {message.deliveredParts} entregues · {message.failedParts} falharam</p>}
          {message.errorCode && <p>{diagnoses[message.errorCode] || message.errorCode} <span className="font-mono text-xs">{message.errorCode}</span></p>}
          {message.state === "QUEUED" && <Button className="w-fit" variant="outline" disabled={busy} onClick={() => void mutate(async () => {
            await write(pilot + "/messages", { id: message.id, action: "cancel" }, "PATCH");
          })}>Cancelar</Button>}
        </div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Integração por API</CardTitle></CardHeader><CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">Uma chave ativa para consultar, enfileirar e cancelar mensagens desta conta.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={buttonDisabled} onClick={() => void mutate(async () => {
            const { token } = await write<{ token: string }>(pilot, { action: "issue-key" });
            setApiToken(token);
          })}>{overview?.key ? "Substituir chave" : "Gerar chave"}</Button>
          {overview?.key && <Button variant="outline" disabled={buttonDisabled} onClick={() => void mutate(async () => {
            await write(pilot, { action: "revoke-key" });
            setApiToken("");
          })}>Revogar chave</Button>}
        </div>
        {apiToken && <Input aria-label="Chave da API exibida uma vez" readOnly value={apiToken} />}
      </CardContent></Card>
    </div>
  );
}
