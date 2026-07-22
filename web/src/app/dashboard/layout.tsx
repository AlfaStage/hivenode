import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { getGravatarProfile } from "@/lib/gravatar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | HiveNode",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  // Busca o e-mail do usuário no banco de dados pois o TokenJWT guarda apenas userId
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { email: true }
  });

  if (!dbUser) {
    redirect("/login");
  }

  // Busca do perfil no Gravatar protegida por cache no servidor
  const profile = await getGravatarProfile(dbUser.email);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar remodelada */}
      <Sidebar role={user.role} />

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col bg-muted/20">
        <Header 
          userRole={user.role} 
          avatarUrl={profile.avatar_url} 
          name={profile.display_name} 
        />
        
        <div className="p-8 md:p-10">{children}</div>
      </main>
    </div>
  );
}
