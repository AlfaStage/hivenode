import { notFound } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAuthenticatedUser } from "@/lib/auth";
import { canAccessSmsBeta } from "@/lib/sms-beta-access";
import { SmsPilotPanel } from "./sms-pilot-panel";

export default async function SmsBetaPage() {
  const user = await getAuthenticatedUser();
  if (!user || !canAccessSmsBeta(user)) notFound();

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 pb-8">
      <header className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 sm:items-center sm:p-6">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-500">
          <MessageSquareText className="size-6 sm:size-7" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">HiveNode SMS <span className="sr-only">Beta</span></h1>
            <Badge variant="outline" aria-hidden>Beta</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Envie SMS pelo chip do seu Android e acompanhe cada tentativa.</p>
        </div>
      </header>
      <SmsPilotPanel administrator={user.role === "ADMIN"} />
    </div>
  );
}
