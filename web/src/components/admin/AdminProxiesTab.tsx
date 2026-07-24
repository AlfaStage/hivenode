import { HardDrive, Ban, Trash2, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdminProxiesTabProps {
  users: Record<string, unknown>[];
  onUpdate: () => void;
}

export function AdminProxiesTab({ users, onUpdate }: AdminProxiesTabProps) {
  const proxies = users.flatMap(u => 
    (u.nodes as Record<string, unknown>[]).flatMap((n) => 
      (n.proxies as Record<string, unknown>[]).map((p) => ({ ...p, nodeModel: n.deviceModel, ownerEmail: u.email }))
    )
  );

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/proxies/${id}`, {
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
    if (!confirm("Tem certeza que deseja EXCLUIR este proxy? O acesso será revogado na hora.")) return;
    try {
      const res = await fetch(`/api/admin/proxies/${id}`, { method: "DELETE" });
      if (res.ok) onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center gap-2 mb-4">
        <HardDrive className="text-emerald-400" />
        <h2 className="text-xl font-bold text-white">Gestão de Proxies</h2>
      </div>

      <div className="bg-[#111114] border border-[#27272e] rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-[#1a1a20]">
            <TableRow className="border-[#27272e]">
              <TableHead className="text-slate-400">Usuário Proxy</TableHead>
              <TableHead className="text-slate-400">Criador</TableHead>
              <TableHead className="text-slate-400">Nó Vinculado</TableHead>
              <TableHead className="text-slate-400 text-right">Tráfego (Tx/Rx)</TableHead>
              <TableHead className="text-slate-400 text-center">Status</TableHead>
              <TableHead className="text-slate-400 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proxies.map((proxy) => (
              <TableRow key={proxy.id} className="border-[#27272e] hover:bg-[#1a1a20]/50">
                <TableCell className="font-mono text-sm text-slate-300">{proxy.proxyUser}</TableCell>
                <TableCell className="text-slate-400">{proxy.ownerEmail}</TableCell>
                <TableCell className="text-slate-400">{proxy.nodeModel || "Desconhecido"}</TableCell>
                <TableCell className="text-right font-mono text-xs text-slate-500">
                  <span className="text-emerald-500">Tx: {(Number(proxy.totalBytesTx)/1024/1024).toFixed(1)} MB</span><br/>
                  <span className="text-blue-500">Rx: {(Number(proxy.totalBytesRx)/1024/1024).toFixed(1)} MB</span>
                </TableCell>
                <TableCell className="text-center">
                  {proxy.status === "ONLINE" ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20">ATIVO</Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500/20">BLOQUEADO</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {proxy.status !== "BLOCKED" ? (
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(proxy.id, "BLOCKED")} className="border-red-900/30 text-red-500 hover:bg-red-900/20" title="Pausar Proxy">
                        <Ban className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(proxy.id, "ONLINE")} className="border-emerald-900/30 text-emerald-500 hover:bg-emerald-900/20" title="Desbloquear Proxy">
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleDelete(proxy.id)} className="border-red-900/30 hover:bg-red-900/20 text-red-500" title="Excluir Proxy">
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
