"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitBetaApplication } from "./submit";

export function BetaForm({ accountEmail }: { accountEmail?: string }) {
  const [state, action, pending] = useActionState(submitBetaApplication, {});

  if (state.success) return <p role="status">Inscrição recebida. Entraremos em contato se você for selecionado.</p>;

  return (
    <form action={action} className="flex flex-col gap-4">
      {accountEmail ? (
        <>
          <input type="hidden" name="account" value="true" />
          <p className="text-sm">Sua inscrição será vinculada à conta <strong className="break-all">{accountEmail}</strong>.</p>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-2 text-sm font-medium">
            E-mail
            <Input type="email" name="email" autoComplete="email" maxLength={254} defaultValue={state.email} required />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Número de contato
            <Input type="tel" name="phone" autoComplete="tel" maxLength={32} defaultValue={state.phone} required />
          </label>
        </>
      )}
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar inscrição"}
      </Button>
    </form>
  );
}
