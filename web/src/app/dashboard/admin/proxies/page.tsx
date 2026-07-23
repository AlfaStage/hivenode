"use client";

import { useState, useEffect } from "react";
import { Shield, Activity, Search, Ban, CheckCircle, Trash2, HardDrive, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminProxiesPage() {
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

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/proxies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja EXCLUIR esta credencial de proxy? O acesso será interrompido imediatamente.")) return;
    try {
      const res = await fetch(`/api/admin/proxies/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const proxies = users.flatMap((u) =>
    (u.nodes || []).flatMap((n: any) =>
      (n.proxies || []).map((p: any) => ({
        ...p,
        nodeModel: n.deviceModel,
        ownerEmail: u.email,
      }))
    )
  );

  const filteredProxies = proxies.filter(
    (p) =>
      p.proxyUser.toLowerCase().includes(search.toLowerCase()) ||
      p.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
      (p.nodeModel || "").toLowerCase().includes(search.toLowerCase())
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
          <Shield className="text-emerald-400 w-8 h-8" />
          Gestão de Proxies
        </h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">
          Controle de credenciais de acesso SOCKS5/HTTP e auditoria de tráfego de dados.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário, e-mail ou nó..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/40 border-border"
          />
        </div>
        <div className="text-sm font-semibold text-muted-foreground">
          Total de Proxies: <span className="text-emerald-400 font-bold">{filteredProxies.length}</span>
        </div>
      </div>

      <Card className="border-border bg-card/40 overflow-hidden">
        {filteredProxies.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhuma credencial de proxy gerada ainda.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground font-bold">Usuário Proxy</TableHead>
                <TableHead className="text-muted-foreground font-bold">Proprietário</TableHead>
                <TableHead className="text-muted-foreground font-bold">Aparelho Vinculado</TableHead>
                <TableHead className="text-muted-foreground font-bold text-right">Tráfego (Tx/Rx)</TableHead>
                <TableHead className="text-muted-foreground font-bold text-center">Status</TableHead>
                <TableHead className="text-muted-foreground font-bold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProxies.map((proxy) => (
                <TableRow key={proxy.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-mono text-sm font-bold text-foreground">{proxy.proxyUser}</TableCell>
                  <TableCell className="text-muted-foreground">{proxy.ownerEmail}</TableCell>
                  <TableCell className="text-muted-foreground flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    {proxy.nodeModel || "Dispositivo Node"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    <div className="flex flex-col items-end">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <ArrowUp className="w-3 h-3" /> {(Number(proxy.totalBytesTx) / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <span className="text-blue-400 flex items-center gap-1">
                        <ArrowDown className="w-3 h-3" /> {(Number(proxy.totalBytesRx) / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {proxy.status === "ONLINE" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">ATIVO</Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/30">PAUSADO</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {proxy.status !== "BLOCKED" ? (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(proxy.id, "BLOCKED")} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                          <Ban className="w-4 h-4 mr-1" /> Pausar
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(proxy.id, "ONLINE")} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                          <CheckCircle className="w-4 h-4 mr-1" /> Ativar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleDelete(proxy.id)} className="border-border hover:bg-destructive/10 text-destructive">
                        <Trash2 className="w-4 h-4" />
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
