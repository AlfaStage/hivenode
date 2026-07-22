import { useState } from "react";
import { Server, Ban, Trash2, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdminNodesTabProps {
  users: any[];
  onUpdate: () => void;
}

export function AdminNodesTab({ users, onUpdate }: AdminNodesTabProps) {
  const nodes = users.flatMap(u => u.nodes.map((n: any) => ({ ...n, ownerEmail: u.email })));

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/nodes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este Aparelho PERMANENTEMENTE? Isso afetará os proxies dele.")) return;
    try {
      const res = await fetch(`/api/admin/nodes/${id}`, { method: "DELETE" });
      if (res.ok) onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center gap-2 mb-4">
        <Server className="text-amber-500" />
        <h2 className="text-xl font-bold text-white">Gestão de Aparelhos (Nodes)</h2>
      </div>

      <div className="bg-[#111114] border border-[#27272e] rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-[#1a1a20]">
            <TableRow className="border-[#27272e]">
              <TableHead className="text-slate-400">ID</TableHead>
              <TableHead className="text-slate-400">Dono</TableHead>
              <TableHead className="text-slate-400">Modelo</TableHead>
              <TableHead className="text-slate-400">Tipo</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map((node) => (
              <TableRow key={node.id} className="border-[#27272e] hover:bg-[#1a1a20]/50">
                <TableCell className="font-mono text-xs text-slate-500">{node.id.split("-")[0]}...</TableCell>
                <TableCell className="text-slate-300">{node.ownerEmail}</TableCell>
                <TableCell className="text-slate-300">{node.deviceModel || "Desconhecido"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-slate-600 text-slate-400">
                    {node.visibility}
                  </Badge>
                </TableCell>
                <TableCell>
                  {node.status === "ONLINE" && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20">ONLINE</Badge>}
                  {node.status === "OFFLINE" && <Badge variant="secondary" className="bg-slate-800 text-slate-400 hover:bg-slate-800">OFFLINE</Badge>}
                  {node.status === "BLOCKED" && <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500/20">BLOCKED</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {node.status !== "BLOCKED" ? (
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(node.id, "BLOCKED")} className="border-red-900/30 text-red-500 hover:bg-red-900/20" title="Bloquear Aparelho">
                        <Ban className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(node.id, "OFFLINE")} className="border-emerald-900/30 text-emerald-500 hover:bg-emerald-900/20" title="Desbloquear Aparelho">
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleDelete(node.id)} className="border-red-900/30 hover:bg-red-900/20 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
