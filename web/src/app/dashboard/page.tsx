import { DashboardLiveBadge } from "@/components/dashboard/DashboardLiveBadge";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Award, Server, ShieldAlert, Zap } from "lucide-react";

export default async function DashboardPage() {
  const authUser = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: {
      email: true,
      role: true,
      balanceGB: true,
      _count: {
        select: {
          nodes: true,
          subscriptions: true,
        },
      },
    },
  });

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Olá, {user?.email?.split("@")[0]}
          </h1>
          <p className="text-base text-muted-foreground mt-2 font-medium">
            Bem-vindo ao painel de controle de alta performance HiveNode.
          </p>
        </div>
        <DashboardLiveBadge />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card/40 backdrop-blur-md border border-border/50 shadow-sm rounded-3xl p-6 space-y-3 relative overflow-hidden group hover:border-primary/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Server className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Nodes Ativos</p>
          </div>
          <p className="text-4xl font-black text-foreground tracking-tighter">
            {user?._count.nodes ?? 0}
          </p>
        </div>

        <div className="bg-card/40 backdrop-blur-md border border-border/50 shadow-sm rounded-3xl p-6 space-y-3 relative overflow-hidden group hover:border-primary/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assinaturas</p>
          </div>
          <p className="text-4xl font-black text-foreground tracking-tighter">
            {user?._count.subscriptions ?? 0}
          </p>
        </div>

        <div className="bg-card/40 backdrop-blur-md border border-border/50 shadow-sm rounded-3xl p-6 space-y-3 relative overflow-hidden group hover:border-primary/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Zap className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Saldo (GB)</p>
          </div>
          <p className="text-4xl font-black text-primary tracking-tighter">
            {user?.balanceGB?.toFixed(2) ?? "0.00"}
          </p>
        </div>

        <div className="bg-card/40 backdrop-blur-md border border-border/50 shadow-sm rounded-3xl p-6 space-y-3 relative overflow-hidden group hover:border-primary/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Award className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Plano</p>
          </div>
          <p className="text-3xl font-black text-foreground tracking-tighter mt-1">
            {user?.role === "ADMIN" ? "Administrador" : "Cliente Padrão"}
          </p>
        </div>
      </div>

      {/* Placeholder para gráficos e conteúdo futuro (Fase 2) */}
      <div className="bg-card/40 backdrop-blur-md border border-border/50 shadow-sm rounded-3xl p-10 flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px]">
        <div className="p-4 bg-muted/50 rounded-2xl mb-4">
          <svg className="w-8 h-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <title>Gráficos de Consumo</title>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Gráficos de consumo serão exibidos aqui</h3>
        <p className="text-sm max-w-md mx-auto">
          Os detalhes de tráfego, nodes online e histórico de uso serão
          expandidos na próxima fase de desenvolvimento.
        </p>
      </div>
    </div>
  );
}
