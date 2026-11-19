"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const endpoint = "/api/sms/beta/messages";
const stateLabels = {
  QUEUED: "Na fila", SENT: "Envio sem recibo", DELIVERED: "Entrega confirmada",
  FAILED: "Falha", UNKNOWN: "Resultado desconhecido", CANCELED: "Cancelado",
} as const;

type Message = {
  id: string;
  maskedDestination: string;
  scenario: Exclude<keyof typeof stateLabels, "QUEUED" | "CANCELED">;
  state: keyof typeof stateLabels;
};

async function sendRequest<T>(init: RequestInit) {
  const response = await fetch(endpoint, { ...init, cache: "no-store" });
  const body = await response.json() as { data: T; error?: string };
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir o teste.");
  return body.data;
}

export function SmsBetaPanel() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pendingKey = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    sendRequest<{ messages: Message[] }>({ signal: controller.signal })
      .then(data => setMessages(data.messages))
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = JSON.stringify({ destination: fields.get("destination"), text: fields.get("text"), scenario: fields.get("scenario") });
    pendingKey.current ??= crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      const { message } = await sendRequest<{ message: Message }>({ method: "POST", body,
        headers: { "Content-Type": "application/json", "Idempotency-Key": pendingKey.current } });
      setMessages(current => [message, ...(current ?? []).filter(item => item.id !== message.id)].slice(0, 50));
      pendingKey.current = null;
      form.reset();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao criar o teste.");
    } finally {
      setBusy(false);
    }
  }

  async function changeMessage(id: string, action: "simulate" | "cancel") {
    setBusy(true);
    setError("");
    try {
      const { message } = await sendRequest<{ message: Message }>({ method: "PATCH",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      setMessages(current => current?.map(item => item.id === id ? message : item) ?? null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao atualizar o teste.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Novo teste</CardTitle>
          <CardDescription>Use um número fictício no formato internacional e escolha qual resultado simular.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit} onChange={() => { pendingKey.current = null; }}>
            <fieldset className="flex flex-col gap-4" disabled={busy}>
              <label className="flex flex-col gap-1 text-sm">
                Destino fictício
                <Input name="destination" type="tel" placeholder="+5511999999999" pattern="\+[1-9][0-9]{7,14}" required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Mensagem de teste
                <Input name="text" maxLength={480} required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Resultado simulado
                <select name="scenario" className="h-9 rounded-md border border-input bg-background px-2">
                  <option value="DELIVERED">Entrega confirmada</option>
                  <option value="SENT">Envio sem recibo</option>
                  <option value="FAILED">Falha</option>
                  <option value="UNKNOWN">Resultado desconhecido</option>
                </select>
              </label>
              <Button type="submit" disabled={busy || messages === null} className="self-start">Colocar na fila de testes</Button>
            </fieldset>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Histórico de testes</CardTitle></CardHeader>
        <CardContent aria-live="polite">
          {messages === null && !error && <p className="text-sm text-muted-foreground">Carregando testes…</p>}
          {messages?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum teste criado.</p>}
          {messages && messages.length > 0 && <ul className="divide-y">
            {messages.map(message => (
              <li key={message.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="text-sm">
                  <p>{message.maskedDestination}</p>
                  <p className="text-muted-foreground">{stateLabels[message.state]}</p>
                </div>
                {message.state === "QUEUED" && <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" type="button" disabled={busy} onClick={() => void changeMessage(message.id, "simulate")}>
                    Simular {stateLabels[message.scenario].toLowerCase()}
                  </Button>
                  <Button variant="ghost" size="sm" type="button" disabled={busy} onClick={() => void changeMessage(message.id, "cancel")}>Cancelar</Button>
                </div>}
              </li>
            ))}
          </ul>}
        </CardContent>
      </Card>
    </>
  );
}
