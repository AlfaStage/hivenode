import Link from "next/link";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const pageSize = 50;
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function AdminBetaPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const requestedPage = Number((await searchParams).page);
  const totalPages = Math.max(1, Math.ceil(await prisma.betaApplication.count() / pageSize));
  const page = Number.isSafeInteger(requestedPage) ? Math.min(totalPages, Math.max(1, requestedPage)) : 1;
  const applications = await prisma.betaApplication.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { user: { select: { email: true } } },
  });

  return (
    <section className="flex flex-col gap-5">
      <Link href="/dashboard/admin/users" className="self-start text-sm underline underline-offset-4">Voltar para Usuários</Link>
      <h1 className="text-3xl font-bold">Inscrições para o beta</h1>
      {applications.length === 0 ? <p className="text-muted-foreground">Nenhuma inscrição recebida.</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Número de contato</TableHead>
              <TableHead>Data da inscrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map(application => (
              <TableRow key={application.id}>
                <TableCell>{application.user?.email ?? application.email}</TableCell>
                <TableCell>{application.user ? "Conta vinculada" : "Visitante"}</TableCell>
                <TableCell>{application.phone ?? "—"}</TableCell>
                <TableCell>{dateFormat.format(application.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {totalPages > 1 && (
        <nav aria-label="Paginação das inscrições" className="flex flex-wrap items-center gap-4 text-sm">
          {page > 1 && <Link className="underline" href={`?page=${page - 1}`}>Anterior</Link>}
          <span>Página {page} de {totalPages}</span>
          {page < totalPages && <Link className="underline" href={`?page=${page + 1}`}>Próxima</Link>}
        </nav>
      )}
    </section>
  );
}
