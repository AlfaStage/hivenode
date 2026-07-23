"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, Users, Server, Shield, CreditCard, Activity, ArrowUpRight, TrendingUp, Pickaxe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function AdminOverviewPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsers(data.data.users || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin text-amber-500"><Activity size={48} /></div>
      </div>
    );
  }

  const totalUsers = users.length;
  const totalNodes = users.reduce((acc, u) => acc + (u.nodes?.length || 0), 0);
  const activeNodes = users.reduce((acc, u) => {
    return acc + (u.nodes?.filter((n: any) => n.status === "ONLINE").length || 0);
  }, 0);
  const totalProxies = users.reduce((acc, u) => {
    return acc + (u.nodes?.reduce((a: number, n: any) => a + (n.proxies?.length || 0), 0) || 0);
  }, 0);
  const totalSubscriptions = users.reduce((acc, u) => acc + (u.subscriptions?.length || 0), 0);
  const totalPoints = users.reduce((acc, u) => acc + (u.hivePoints || 0), 0);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Page Title Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          <LayoutDashboard className="text-amber-500 w-8 h-8" />
          Administração — Visão Geral
        </h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">
          Métricas globais de saúde da rede HiveNode, usuários e tráfego.
        </p>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-border bg-card/40 relative overflow-hidden shadow-sm hover:border-amber-500/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total de Usuários</CardTitle>
            <Users className="w-5 h-5 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" /> Base ativa de clientes
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5 relative overflow-hidden shadow-sm hover:border-amber-500 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-amber-500">Aparelhos Conectados</CardTitle>
            <Server className="w-5 h-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-500">{totalNodes}</div>
            <p className="text-xs text-emerald-400 mt-1 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {activeNodes} online na rede
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/40 relative overflow-hidden shadow-sm hover:border-emerald-500/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Proxies Gerados</CardTitle>
            <Shield className="w-5 h-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{totalProxies}</div>
            <p className="text-xs text-muted-foreground mt-1">Credenciais SOCKS5/HTTP</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/40 relative overflow-hidden shadow-sm hover:border-primary/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Assinaturas Ativas</CardTitle>
            <CreditCard className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{totalSubscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1">Planos contratados</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border bg-card/40 hover:bg-card/60 transition-all cursor-pointer">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Usuários
              </CardTitle>
              <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <CardDescription>Gerencie contas, saldos em GB e permissões.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/admin/users" className="text-sm font-bold text-primary hover:underline">
              Ir para gestão de usuários &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/40 hover:bg-card/60 transition-all cursor-pointer">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-500" />
                Aparelhos (Nodes)
              </CardTitle>
              <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <CardDescription>Monitore status, IPs e bloqueie dispositivos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/admin/nodes" className="text-sm font-bold text-amber-500 hover:underline">
              Ir para aparelhos &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/40 hover:bg-card/60 transition-all cursor-pointer">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                Proxies
              </CardTitle>
              <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <CardDescription>Controle de credenciais e consumo de tráfego.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/admin/proxies" className="text-sm font-bold text-emerald-400 hover:underline">
              Ir para proxies &rarr;
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table: Recent Users */}
      <Card className="border-border bg-card/40">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Últimos Usuários Cadastrados</CardTitle>
          <CardDescription>Visualização rápida das contas mais recentes no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.slice(0, 5).map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">Cadastrado em {new Date(user.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  <span className="text-xs font-mono text-emerald-400 font-bold">{user.balanceGB} GB</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
