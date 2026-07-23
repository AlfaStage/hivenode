"use client";

import { useState, useEffect } from "react";
import { Server, Activity, Search, Ban, CheckCircle, Trash2, Smartphone, HardDrive } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminNodesPage() {
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
      const res = await fetch(`/api/admin/nodes/${id}`, {
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
    if (!confirm("Tem certeza que deseja apagar este Aparelho PERMANENTEMENTE?")) return;
    try {
      const res = await fetch(`/api/admin/nodes/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const nodes = users.flatMap((u) =>
    (u.nodes || []).map((n: any) => ({
      ...n,
      ownerEmail: u.email,
    }))
  );

  const filteredNodes = nodes.filter(
    (n) =>
      n.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
      (n.deviceModel || "").toLowerCase().includes(search.toLowerCase()) ||
      (n.ipAddress || "").toLowerCase().includes(search.toLowerCase())
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
          <Server className="text-amber-500 w-8 h-8" />
          Gestão de Aparelhos (Nodes)
        </h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">
          Monitoramento e controle de todos os dispositivos móveis e servidores BYOD registrados na rede.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por dono, modelo ou IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/40 border-border"
          />
        </div>
        <div className="text-sm font-semibold text-muted-foreground">
          Total de Aparelhos: <span className="text-amber-500 font-bold">{filteredNodes.length}</span>
        </div>
      </div>

      <Card className="border-border bg-card/40 overflow-hidden">
        {filteredNodes.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhum aparelho registrado encontrado.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground font-bold">ID Nó</TableHead>
                <TableHead className="text-muted-foreground font-bold">Proprietário</TableHead>
                <TableHead className="text-muted-foreground font-bold">Modelo do Dispositivo</TableHead>
                <TableHead className="text-muted-foreground font-bold">Visibilidade</TableHead>
                <TableHead className="text-muted-foreground font-bold">IP</TableHead>
                <TableHead className="text-muted-foreground font-bold">Status</TableHead>
                <TableHead className="text-muted-foreground font-bold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNodes.map((node) => (
                <TableRow key={node.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {node.id.split("-")[0]}...
                  </TableCell>
                  <TableCell className="font-bold text-foreground">{node.ownerEmail}</TableCell>
                  <TableCell className="text-foreground flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    {node.deviceModel || "Dispositivo Android"}
                  </TableCell>
                  <TableCell>
                    {node.visibility === "PUBLIC" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">MINER (PUBLIC)</Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">PROXY (PRIVATE)</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {node.ipAddress || "Automático"}
                  </TableCell>
                  <TableCell>
                    {node.status === "ONLINE" && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">ONLINE</Badge>
                    )}
                    {node.status === "OFFLINE" && (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">OFFLINE</Badge>
                    )}
                    {node.status === "BLOCKED" && (
                      <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/30">BLOQUEADO</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {node.status !== "BLOCKED" ? (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(node.id, "BLOCKED")} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                          <Ban className="w-4 h-4 mr-1" /> Bloquear
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(node.id, "OFFLINE")} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                          <CheckCircle className="w-4 h-4 mr-1" /> Liberar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleDelete(node.id)} className="border-border hover:bg-destructive/10 text-destructive">
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
