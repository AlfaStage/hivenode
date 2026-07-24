import { useState } from "react";
import { Users, Edit, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface AdminUsersTabProps {
  users: Record<string, unknown>[];
  onUpdate: () => void;
}

export function AdminUsersTab({ users, onUpdate }: AdminUsersTabProps) {
  const [editingUser, setEditingUser] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState({ role: "", balanceGB: 0, hivePoints: 0 });
  const [loading, setLoading] = useState(false);

  const handleEditClick = (user: Record<string, unknown>) => {
    setEditingUser(user);
    setEditForm({
      role: user.role as string,
      balanceGB: user.balanceGB as number,
      hivePoints: user.hivePoints as number,
    });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingUser(null);
        onUpdate();
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este usuário PERMANENTEMENTE?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-slate-400" />
        <h2 className="text-xl font-bold text-white">Gestão de Usuários</h2>
      </div>

      <div className="bg-[#111114] border border-[#27272e] rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-[#1a1a20]">
            <TableRow className="border-[#27272e]">
              <TableHead className="text-slate-400">E-mail</TableHead>
              <TableHead className="text-slate-400">Cargo</TableHead>
              <TableHead className="text-slate-400">Saldo (GB)</TableHead>
              <TableHead className="text-slate-400">Pontos (PTS)</TableHead>
              <TableHead className="text-slate-400 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="border-[#27272e] hover:bg-[#1a1a20]/50">
                <TableCell className="font-medium text-white">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "ADMIN" ? "default" : "secondary"} className={user.role === "ADMIN" ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-amber-500/50" : ""}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-emerald-400 font-mono">{user.balanceGB} GB</TableCell>
                <TableCell className="text-amber-400 font-mono">{user.hivePoints} PTS</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(user)} className="border-slate-700 hover:bg-slate-800">
                      <Edit className="w-4 h-4 text-slate-300" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(user.id)} className="border-red-900/30 hover:bg-red-900/20 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-[#111114] border-[#27272e] text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-400">Cargo</label>
              <select
                className="flex h-10 w-full rounded-md border border-[#27272e] bg-[#0d0d10] px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              >
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-400">Saldo (GB)</label>
              <Input
                type="number"
                value={editForm.balanceGB}
                onChange={(e) => setEditForm({ ...editForm, balanceGB: parseFloat(e.target.value) })}
                className="bg-[#0d0d10] border-[#27272e]"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-400">HivePoints</label>
              <Input
                type="number"
                value={editForm.hivePoints}
                onChange={(e) => setEditForm({ ...editForm, hivePoints: parseFloat(e.target.value) })}
                className="bg-[#0d0d10] border-[#27272e]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} className="border-slate-700">Cancelar</Button>
            <Button onClick={handleSave} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-black">
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
