import { notFound } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { canAccessSmsBeta } from "@/lib/sms-beta-access";
import { SmsPilotPanel } from "./sms-pilot-panel";

export default async function SmsBetaPage() {
  const user = await getAuthenticatedUser();
  if (!user || !canAccessSmsBeta(user)) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">HiveNode SMS Beta</h1>
        <p className="text-sm text-muted-foreground">Envio pelo chip do seu Android para um destino aprovado no piloto.</p>
      </header>
      <SmsPilotPanel administrator={user.role === "ADMIN"} />
    </div>
  );
}
