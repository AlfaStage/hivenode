"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, CirclePause, Clock3, Copy, CreditCard, History, Inbox, KeyRound, Link2, QrCode, Send, ShieldCheck, Smartphone, Unlink, type LucideIcon } from "lucide-react";
import QRCode from "react-qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Binding = { id: string; slot: number; label: string };
type Destination = { id: string; mask: string };
type Device = {
  id: string; label: string; bindings: Binding[]; lastSeenAt: string | null;
  selectedBinding: string | null; approvedBinding: string | null; pendingBinding: string | null;
  destinationMask: string | null;
  approvedDestinations: Destination[];
};
type Message = {
  id: string; maskedDestination: string; state: string; createdAt: string;
  sentParts: number; deliveredParts: number; failedParts: number; totalParts: number; errorCode: string | null;
};
type Overview = { devices: Device[]; key: { id: string } | null; realSendEnabled: boolean; consentVersion: string; maxApprovedDestinations: number };
type Pending = Pick<Device, "id" | "label" | "pendingBinding" | "approvedBinding" | "destinationMask" | "bindings"> & {
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

function Notice({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm">
    <Icon className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
    <p>{children}</p>
  </div>;
}

export function SmsPilotPanel({ administrator }: { administrator: boolean }) {
  const [overview, setOverview] = useState<Overview>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [pair, setPair] = useState<{ code: string; expiresAt: string }>();
  const [apiToken, setApiToken] = useState("");
  const [apiOpen, setApiOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [reviewNumber, setReviewNumber] = useState("");
  const [addingDestination, setAddingDestination] = useState(false);
  const [body, setBody] = useState("");
  const [verified, setVerified] = useState(false);
  const [reviewedDevice, setReviewedDevice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sendFeedback, setSendFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(0);
  const nextKey = useRef("");
  const reviewField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingDestination) reviewField.current?.focus();
  }, [addingDestination]);

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

  async function mutate(task: () => Promise<void>, report = setFeedback) {
    setBusy(true);
    report("");
    try {
      await task();
      await refresh().catch(error => setFeedback((error as Error).message));
    } catch (error) {
      report((error as Error).message);
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
  const destination = number.trim().replace(/[\s().-]/g, "");
  const differentSimSelected = Boolean(device?.approvedBinding && line && device.approvedBinding !== line.id);
  const online = device?.lastSeenAt && refreshedAt - Date.parse(device.lastSeenAt) < 90_000;
  const pairValid = pair && refreshedAt < Date.parse(pair.expiresAt);
  const buttonDisabled = busy || !overview;

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!device || busy) return;
    if (!/^\+55[1-9]\d{9,10}$/.test(destination)) {
      setSendFeedback("Informe o número de teste com +55, DDD e número, como +5562999999999.");
      return;
    }
    nextKey.current ||= crypto.randomUUID();
    void mutate(async () => {
      await write(pilot + "/messages", { deviceId: device.id, destination, text: body }, "POST", nextKey.current);
      nextKey.current = "";
      setBody("");
      setSendFeedback("Mensagem na fila. Acompanhe a resposta do Android abaixo.");
    }, setSendFeedback);
  }

  const approvedDestinations = device?.approvedDestinations ?? [];
  const approved = Boolean(device?.approvedBinding && approvedDestinations.length);
  const ready = Boolean(online && device?.selectedBinding && device.selectedBinding === device.approvedBinding);
  const waitingForReview = Boolean(device?.pendingBinding && device.pendingBinding === line?.id);
  const canRequestReview = Boolean(line && !waitingForReview && (!approved || differentSimSelected || addingDestination));
  const reviewDestination = reviewNumber.trim().replace(/[\s().-]/g, "");

  function changeNumber(value: string) {
    setNumber(value);
    nextKey.current = "";
    setSendFeedback("");
  }

  function requestReview() {
    if (!device || !line) return;
    void mutate(async () => {
      await write(pilot, { action: "request-approval", deviceId: device.id, bindingId: line.id,
        destination: reviewDestination, verifiedByOwner: true, consentVersion: overview?.consentVersion });
      setVerified(false);
      setReviewNumber("");
      setAddingDestination(false);
      setFeedback("Número enviado para revisão.");
    });
  }

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setFeedback(label + " copiado."); }
    catch { setFeedback("Selecione o código e copie manualmente."); }
  }

  const numberField = (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor="sms-pilot-number">Número de teste com DDI</label>
      <Input id="sms-pilot-number" type="tel" autoComplete="tel" placeholder="+55 (00) 00000-0000" value={number}
        onChange={event => changeNumber(event.target.value)} className="h-10" />
    </div>
  );

  return (
    <div className="grid min-w-0 gap-5">
      {overview && !overview.realSendEnabled && <Notice icon={CirclePause}>Envio real pausado pela operação.</Notice>}
      {feedback && <p role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">{feedback}</p>}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <Card className="min-w-0 [--card-spacing:--spacing(5)]">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg"><Send className="size-4 text-amber-500" aria-hidden /> Enviar SMS</CardTitle>
            <CardDescription>O envio usa a franquia ou o saldo da linha aprovada.</CardDescription>
            {approved && ready && overview?.realSendEnabled && <CardAction><Badge variant="secondary">Pronto para enviar</Badge></CardAction>}
          </CardHeader>
          <CardContent>
            {!overview ? <Skeleton className="h-28 w-full" /> : canRequestReview ? (
              <div className="flex flex-col gap-4">
                <Notice icon={ShieldCheck}>{differentSimSelected
                  ? "Você selecionou outro chip. Pedir a aprovação dele cancela a fila da linha anterior."
                  : approved ? "Solicite a aprovação de mais um número para este chip."
                    : "Solicite a aprovação deste chip e de um número de teste."}</Notice>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" htmlFor="sms-review-number">Número a aprovar com DDI</label>
                  <Input ref={reviewField} id="sms-review-number" type="tel" placeholder="+55 (00) 00000-0000" value={reviewNumber}
                    onChange={event => setReviewNumber(event.target.value)} className="h-10" />
                </div>
                <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <input className="mt-1 size-4 shrink-0 accent-amber-500" type="checkbox" checked={verified}
                    onChange={event => setVerified(event.target.checked)} />
                  Confirmo que tenho autorização para enviar SMS a este número e que a operadora permite este uso da linha.
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={buttonDisabled || !verified || !online || !/^\+55[1-9]\d{9,10}$/.test(reviewDestination)} onClick={requestReview}>
                    <ShieldCheck data-icon="inline-start" /> Solicitar aprovação
                  </Button>
                  {approved && !differentSimSelected && <Button variant="outline" onClick={() => {
                    setVerified(false); setReviewNumber(""); setAddingDestination(false);
                  }}>Voltar ao envio</Button>}
                </div>
              </div>
            ) : !approved && device?.pendingBinding ? (
              <Notice icon={Clock3}>A aprovação de {device?.destinationMask} está em revisão.</Notice>
            ) : approved && device ? (
              <form onSubmit={send} className="flex flex-col gap-4">
                {!ready && <Notice icon={Smartphone}>Abra a tela SMS Beta no Android, selecione o SIM aprovado e mantenha a tela aberta.</Notice>}
                {numberField}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" htmlFor="sms-pilot-body">Mensagem</label>
                  <textarea id="sms-pilot-body" rows={4} maxLength={420} required value={body} aria-describedby="sms-character-count"
                    onChange={event => { setBody(event.target.value); nextKey.current = ""; setSendFeedback(""); }}
                    placeholder="Escreva a mensagem de teste" className="min-h-28 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50" />
                  <p id="sms-character-count" className="text-right text-xs tabular-nums text-muted-foreground">{body.length}/420 caracteres</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" className="min-h-10 w-full sm:w-fit"
                    disabled={busy || !overview.realSendEnabled || differentSimSelected || !number || !body.trim()}>
                    <Send data-icon="inline-start" /> Colocar na fila de envio
                  </Button>
                  <p role="status" aria-label="Resultado do envio" className="text-sm text-muted-foreground empty:hidden">{sendFeedback}</p>
                </div>
              </form>
            ) : (
              <Notice icon={device ? Smartphone : Link2}>
                {device ? "Abra o SMS Beta no Android e selecione um SIM para solicitar a aprovação."
                  : "Vincule um Android para configurar o chip de envio."}
              </Notice>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 [--card-spacing:--spacing(5)]">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg"><Smartphone className="size-4 text-amber-500" aria-hidden /> Aparelho e chip</CardTitle>
            <CardDescription>{device?.label ?? "Seu Android é o remetente do SMS."}</CardDescription>
            {device && <CardAction><Badge variant={online ? "secondary" : "outline"}>{online ? "App conectado" : "App desconectado"}</Badge></CardAction>}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!overview ? <Skeleton className="h-20 w-full" /> : !device ? <>
              <p className="text-sm text-muted-foreground">No app HiveNode, entre na mesma conta e abra SMS Beta para fazer o vínculo.</p>
              <Button className="w-fit" disabled={buttonDisabled} onClick={() => void mutate(async () => setPair(await write(pilot, { action: "pair" })))}>
                <QrCode data-icon="inline-start" /> Gerar código de vínculo
              </Button>
              {pairValid && <div className="flex min-w-0 flex-col items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div className="self-center rounded-lg bg-white p-3"><QRCode value={pair.code} size={144} title="QR de vínculo do SMS" /></div>
                <p className="text-sm text-muted-foreground">Escaneie o QR ou cole o código no app. Ele é válido por 5 minutos.</p>
                <Input aria-label="Código de vínculo" value={pair.code} readOnly className="font-mono" />
                <Button variant="outline" size="sm" onClick={() => void copy(pair.code, "Código")}><Copy data-icon="inline-start" /> Copiar código</Button>
              </div>}
            </> : <>
              {device.bindings.length ? <ul className="divide-y divide-border rounded-lg border border-border">
                {device.bindings.map(binding => <li key={binding.id} className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <CreditCard className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">SIM {binding.slot + 1}</p>
                      <p className="break-words text-xs text-muted-foreground">{binding.label}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {binding.id === device.approvedBinding && <Badge variant="secondary">Aprovado</Badge>}
                    {binding.id === device.selectedBinding && <Badge variant="outline">Selecionado</Badge>}
                  </div>
                </li>)}
              </ul> : <p className="text-sm text-muted-foreground">O app ainda não informou chips disponíveis.</p>}
              {device.approvedBinding && <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Destinos aprovados <span className="text-muted-foreground">
                  ({approvedDestinations.length}/{overview.maxApprovedDestinations})
                </span></p>
                {approvedDestinations.length ? <ul className="divide-y divide-border rounded-lg border border-border">
                  {approvedDestinations.map(item => <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" key={item.id}>
                    <span className="font-mono text-sm">{item.mask}</span>
                    <Button variant="ghost" size="sm" disabled={busy} aria-label={`Revogar destino ${item.mask}`} onClick={() => {
                      if (!window.confirm(`Revogar ${item.mask} e cancelar os SMS desse número que ainda estão na fila?`)) return;
                      void mutate(async () => { await write(pilot, { action: "revoke-destination", deviceId: device.id, destinationId: item.id }); });
                    }}>Revogar</Button>
                  </li>)}
                </ul> : <p className="text-xs text-muted-foreground">Cadastre um número autorizado para enviar SMS.</p>}
                {device.pendingBinding && approved && <Notice icon={Clock3}>{device.destinationMask} está em revisão.</Notice>}
                {approved && !device.pendingBinding && approvedDestinations.length < overview.maxApprovedDestinations && (
                  <Button variant="outline" size="sm" className="w-fit" disabled={!ready || busy || addingDestination} onClick={() => setAddingDestination(true)}>
                    Adicionar número
                  </Button>
                )}
                {approved && !device.pendingBinding && !ready && <p className="text-xs text-muted-foreground">Selecione o SIM aprovado no Android para adicionar números.</p>}
              </div>}
              <Button className="w-fit" variant="outline" size="sm" disabled={buttonDisabled} onClick={() => void mutate(async () => {
                await write(pilot, { action: "revoke-device", deviceId: device.id });
              })}><Unlink data-icon="inline-start" /> Desvincular aparelho</Button>
            </>}
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 [--card-spacing:--spacing(5)]">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-lg"><History className="size-4 text-amber-500" aria-hidden /> Histórico</CardTitle>
          <CardDescription>Veja o andamento e o retorno do Android para cada tentativa.</CardDescription>
        </CardHeader>
        <CardContent>
          {!overview ? <Skeleton className="h-20 w-full" /> : !messages.length ? <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Inbox className="size-5 shrink-0" aria-hidden /> Nenhum envio real registrado.
          </div> : <ul className="divide-y divide-border rounded-lg border border-border">
            {messages.map(message => <li key={message.id} className="grid min-w-0 gap-2 px-3 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start sm:px-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Badge variant={message.state === "FAILED" || message.state === "PARTIAL" ? "destructive" :
                    message.state === "DELIVERED" || message.state === "SENT" ? "secondary" : "outline"}>{states[message.state] ?? message.state}</Badge>
                  <p className="text-sm font-medium">{message.maskedDestination}</p>
                  <time dateTime={message.createdAt} className="text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString("pt-BR")}</time>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{message.id}</p>
                {message.totalParts > 0 && <p className="mt-1 text-xs text-muted-foreground">{message.sentParts}/{message.totalParts} enviadas · {message.deliveredParts} entregues · {message.failedParts} falharam</p>}
                {message.errorCode && <p className="mt-1 break-words text-sm">{diagnoses[message.errorCode] ?? message.errorCode} <span className="font-mono text-xs text-muted-foreground">{message.errorCode}</span></p>}
              </div>
              {message.state === "QUEUED" && <Button className="w-fit" variant="outline" size="sm" disabled={busy} onClick={() => void mutate(async () => {
                await write(pilot + "/messages", { id: message.id, action: "cancel" }, "PATCH");
              })}>Cancelar</Button>}
            </li>)}
          </ul>}
        </CardContent>
      </Card>

      {administrator && pending.length > 0 && <Card className="min-w-0 [--card-spacing:--spacing(5)]">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="size-4 text-amber-500" aria-hidden /> Revisão administrativa</CardTitle>
          <CardDescription>Confira a permissão da operadora e a autorização do destinatário.</CardDescription>
          <CardAction><Badge variant="outline">{pending.length} pendente{pending.length > 1 ? "s" : ""}</Badge></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pending.map(item => <div key={item.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="break-all text-sm font-medium">{item.user.email}</p>
              <p className="break-words text-sm text-muted-foreground">{item.label} · {item.bindings.find(binding => binding.id === item.pendingBinding)?.label} · {item.destinationMask}</p>
            </div>
            <label className="flex items-start gap-2.5 text-sm">
              <input className="mt-1 size-4 shrink-0 accent-amber-500" type="checkbox" checked={reviewedDevice === item.approvalToken}
                onChange={event => setReviewedDevice(event.target.checked ? item.approvalToken : "")} />
              Conferi a elegibilidade da linha e a autorização para este número.
            </label>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || reviewedDevice !== item.approvalToken} onClick={() => void mutate(async () => {
                await write(pilot + "/admin", { deviceId: item.id, bindingId: item.pendingBinding, action: "approve",
                  approvalToken: item.approvalToken, carrierReviewed: true });
                setReviewedDevice("");
              })}>{item.approvedBinding === item.pendingBinding ? "Aprovar número" : "Aprovar linha e número"}</Button>
              <Button variant="outline" disabled={busy} onClick={() => void mutate(async () => {
                await write(pilot + "/admin", { deviceId: item.id, bindingId: item.pendingBinding, action: "decline",
                  approvalToken: item.approvalToken });
              })}>Recusar</Button>
            </div>
          </div>)}
        </CardContent>
      </Card>}

      <Collapsible open={apiOpen} onOpenChange={setApiOpen}>
        <Card className="min-w-0 [--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="size-4 text-amber-500" aria-hidden /> Integração por API</CardTitle>
            <CardDescription>{overview?.key ? "Uma chave ativa nesta conta." : "Gerencie o acesso para integrações."}</CardDescription>
            <CardAction><CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
              {apiOpen ? "Ocultar" : "Gerenciar"}<ChevronDown data-icon="inline-end" className={apiOpen ? "rotate-180" : ""} />
            </CollapsibleTrigger></CardAction>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">A chave permite consultar, enfileirar e cancelar mensagens da conta.</p>
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
              {apiToken && <div className="flex flex-col gap-1.5">
                <label htmlFor="sms-api-key" className="text-sm font-medium">Chave da API exibida uma vez</label>
                <Input id="sms-api-key" type="password" readOnly value={apiToken} />
                <Button className="w-fit" variant="outline" size="sm" onClick={() => void copy(apiToken, "Código")}><Copy data-icon="inline-start" /> Copiar chave</Button>
              </div>}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
