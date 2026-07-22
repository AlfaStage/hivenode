import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { role: true },
  });

  if (dbUser?.role !== "ADMIN") {
    // Total security via backend: non-admins cannot even load the admin pages
    redirect("/dashboard");
  }

  return <>{children}</>;
}
