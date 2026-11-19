"use client";

import { useEffect, useState } from "react";
import { ContactRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Contact = {
  id: string; phoneNumber: string | null; maskedNumber: string;
  lastSentAt: string | null; optedOutAt: string | null; optOutKeyword: string | null;
};
type ContactsPage = { contacts: Contact[]; nextCursor: string | null };

async function loadContacts(query: string, signal?: AbortSignal) {
  const response = await fetch("/api/sms/pilot/contacts?" + query, { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível consultar os contatos.");
  return result.data as ContactsPage;
}

export function SmsGatewayContacts({ simId }: { simId?: string }) {
  const [scope, setScope] = useState<"sim" | "optOut">("sim");
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<{ query: string; generation: number; page: ContactsPage }>();
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const query = scope === "optOut" ? "optedOut=true" : simId ? "simId=" + encodeURIComponent(simId) : "";
  const page = result?.query === query && result.generation === generation ? result.page : undefined;

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    void loadContacts(query, controller.signal).then(contacts => {
      if (!controller.signal.aborted) {
        setError("");
        setResult({ query, generation, page: contacts });
      }
    }).catch(failure => {
      if (!controller.signal.aborted) setError((failure as Error).message);
    });
    return () => controller.abort();
  }, [query, generation]);

  async function next() {
    if (!page?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const more = await loadContacts(query + "&after=" + encodeURIComponent(page.nextCursor));
      setResult(current => current?.query === query && current.generation === generation
        ? { query, generation, page: { contacts: [...current.page.contacts, ...more.contacts], nextCursor: more.nextCursor } }
        : current);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  return <Card className="min-w-0 [--card-spacing:--spacing(5)]">
    <CardHeader className="border-b border-border">
      <CardTitle className="flex items-center gap-2 text-lg"><ContactRound className="size-4 text-amber-500" aria-hidden /> Contatos SMS</CardTitle>
      <CardDescription>Veja os envios do chip selecionado e os descadastros da conta.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={scope === "sim" ? "secondary" : "outline"} size="sm" aria-pressed={scope === "sim"}
          onClick={() => { setError(""); setScope("sim"); }}>Enviados pelo chip</Button>
        <Button variant={scope === "optOut" ? "secondary" : "outline"} size="sm" aria-pressed={scope === "optOut"}
          onClick={() => { setError(""); setScope("optOut"); }}>Descadastros da conta</Button>
        <Button variant="ghost" size="sm" disabled={!query} onClick={() => {
          setError(""); setGeneration(current => current + 1);
        }}>Atualizar contatos</Button>
      </div>
      {error ? <p role="status" className="text-sm">{error}</p> : !query ? (
        <p className="text-sm text-muted-foreground">Selecione um chip no formulário de envio.</p>
      ) : !page ? <p role="status" className="text-sm text-muted-foreground">Carregando contatos…</p> : !page.contacts.length ? (
        <p className="text-sm text-muted-foreground">{scope === "sim" ? "Nenhum envio confirmado neste chip." : "Nenhum descadastro registrado."}</p>
      ) : <ul className="divide-y divide-border rounded-lg border border-border">
        {page.contacts.map(contact => <li key={contact.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
          <span className="font-mono text-sm">{contact.phoneNumber ?? contact.maskedNumber}</span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {contact.optedOutAt && <Badge variant="destructive">Descadastrado</Badge>}
            {scope === "sim" && contact.lastSentAt && <time dateTime={contact.lastSentAt}>{new Date(contact.lastSentAt).toLocaleString("pt-BR")}</time>}
            {scope === "optOut" && contact.optedOutAt && <time dateTime={contact.optedOutAt}>{new Date(contact.optedOutAt).toLocaleString("pt-BR")}</time>}
            {scope === "optOut" && contact.optOutKeyword && <span>{contact.optOutKeyword.replace("NAO_RECEBER", "NÃO RECEBER")}</span>}
          </div>
        </li>)}
      </ul>}
      {page?.nextCursor && <Button variant="outline" size="sm" className="w-fit" disabled={loadingMore}
        onClick={() => void next()}>Mais contatos</Button>}
    </CardContent>
  </Card>;
}
