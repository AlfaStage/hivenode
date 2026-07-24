import { Users, Server, HardDrive, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminOverviewProps {
  users: Record<string, unknown>[];
}

export function AdminOverview({ users }: AdminOverviewProps) {
  const totalUsers = users.length;
  const totalNodes = users.reduce((acc, u) => acc + ((u.nodes as unknown[])?.length || 0), 0);
  const totalProxies = users.reduce((acc, u) => {
    return acc + ((u.nodes as Record<string, unknown>[])?.reduce((a: number, n: Record<string, unknown>) => a + ((n.proxies as unknown[])?.length || 0), 0) || 0);
  }, 0);

  const activeNodes = users.reduce((acc, u) => {
    return acc + ((u.nodes as Record<string, unknown>[])?.filter((n: Record<string, unknown>) => n.status === "ONLINE").length || 0);
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
        <Activity className="text-amber-500" />
        Métricas da Plataforma
      </h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-[#111114] border-[#27272e]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#111114] border-[#27272e]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Aparelhos Conectados</CardTitle>
            <Server className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">{totalNodes}</div>
            <p className="text-xs text-slate-500 mt-1">{activeNodes} online agora</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111114] border-[#27272e]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Proxies Gerados</CardTitle>
            <HardDrive className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{totalProxies}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
