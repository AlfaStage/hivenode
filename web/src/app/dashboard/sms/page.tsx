import { notFound } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { canAccessSmsBeta } from "@/lib/sms-beta-access";
import { SmsBetaPanel } from "./sms-beta-panel";

export default async function SmsBetaPage() {
  if (!canAccessSmsBeta(await getAuthenticatedUser())) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">HiveNode SMS Beta</h1>
        <p className="text-sm text-muted-foreground">Ambiente privado de simulação. Os testes não enviam SMS reais.</p>
      </header>
      <SmsBetaPanel />
    </div>
  );
}
