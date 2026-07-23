"use client";

import { useState, useEffect } from "react";
import { CreditCard, Activity, Search, ShieldCheck, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminSubscriptionsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (subId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${subId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSub = async (subId: string) => {
    if (!confirm("Tem certeza que deseja REMOVER esta assinatura?")) return;
    try {
      const res = await fetch(`/api/admin/subscriptions/${subId}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Flatten subscriptions from all users
  const subscriptions = users.flatMap((u) =>
    (u.subscriptions || []).map((sub: any) => ({
      ...sub,
      userEmail: u.email,
    }))
  );

  const filteredSubs = subscriptions.filter((sub) =>
    sub.userEmail.toLowerCase().includes(search.toLowerCase()) ||
    sub.planType.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin text-amber-500"><Activity size={48} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          <CreditCard className="text-primary w-8 h-8" />
          Gestão de Assinaturas
        </h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">
          Controle de planos ativos, faturamento recorrente e integrações AbacatePay.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por e-mail ou plano..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/40 border-border"
          />
        </div>
        <div className="text-sm font-semibold text-muted-foreground">
          Total de Assinaturas: <span className="text-foreground font-bold">{filteredSubs.length}</span>
        </div>
      </div>

      <Card className="border-border bg-card/40 overflow-hidden">
        {filteredSubs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhuma assinatura encontrada no momento.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground font-bold">Usuário</TableHead>
                <TableHead className="text-muted-foreground font-bold">Plano</TableHead>
                <TableHead className="text-muted-foreground font-bold">Status</TableHead>
                <TableHead className="text-muted-foreground font-bold">ID AbacatePay</TableHead>
                <TableHead className="text-muted-foreground font-bold">Validade</TableHead>
                <TableHead className="text-muted-foreground font-bold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubs.map((sub) => (
                <TableRow key={sub.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-bold text-foreground">{sub.userEmail}</TableCell>
                  <TableCell className="font-semibold text-foreground">{sub.planType}</TableCell>
                  <TableCell>
                    {sub.status === "ACTIVE" && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">ATIVO</Badge>
                    )}
                    {sub.status === "PAST_DUE" && (
                      <Badge variant="destructive" className="bg-amber-500/20 text-amber-500 border-amber-500/30">PENDENTE</Badge>
                    )}
                    {sub.status === "CANCELED" && (
                      <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-red-500/30">CANCELADO</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {sub.abacatePaySubId || "N/A"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR") : "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {sub.status !== "CANCELED" ? (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(sub.id, "CANCELED")} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                          Cancelar
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(sub.id, "ACTIVE")} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                          Ativar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleDeleteSub(sub.id)} className="border-border hover:bg-destructive/10 text-destructive">
                        Remover
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
