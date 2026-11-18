import type { Metadata } from "next";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BetaForm } from "./beta-form";

export const metadata: Metadata = {
  title: "Inscrição para o beta",
  robots: { index: false, follow: false },
};

export default async function BetaPage() {
  const user = await getAuthenticatedUser();
  const account = user && await prisma.user.findUnique({
    where: { id: user.userId },
    select: { email: true, betaApplication: { select: { id: true } } },
  });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle><h1 className="text-2xl font-bold">Inscrição para o beta</h1></CardTitle>
          <CardDescription>Cadastre seu interesse em participar dos próximos testes do HiveNode.</CardDescription>
        </CardHeader>
        <CardContent>
          {account?.betaApplication ? (
            <p role="status">Sua conta já está inscrita.</p>
          ) : (
            <BetaForm accountEmail={account?.email} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
