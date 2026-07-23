"use client";

import { useState, useEffect } from "react";
import { Users, Edit, Trash2, ShieldCheck, Search, Wallet, KeyRound, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    role: "",
    balanceGB: 0,
    hivePoints: 0,
    walletAddress: "",
    twoFactorEnabled: false,
  });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
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
    fetchUsers();
  }, []);

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      balanceGB: user.balanceGB || 0,
      hivePoints: user.hivePoints || 0,
      walletAddress: user.walletAddress || "",
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
    });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja EXCLUIR este usuário PERMANENTEMENTE?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in pb-10">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-80" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          <Users className="text-indigo-400 w-8 h-8" />
          Gestão de Usuários
        </h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">
          Controle de contas, saldos em GB, carteiras Web3, autenticação 2FA e permissões de cargo.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/40 border-border"
          />
        </div>
        <div className="text-sm font-semibold text-muted-foreground">
          Total: <span className="text-foreground font-bold">{filteredUsers.length}</span> usuários
        </div>
      </div>

      <Card className="border-border bg-card/40 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-bold">E-mail</TableHead>
              <TableHead className="text-muted-foreground font-bold">Cargo</TableHead>
              <TableHead className="text-muted-foreground font-bold">Saldo (GB)</TableHead>
              <TableHead className="text-muted-foreground font-bold">Pontos (PTS)</TableHead>
              <TableHead className="text-muted-foreground font-bold">Autenticação 2FA</TableHead>
              <TableHead className="text-muted-foreground font-bold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} className="border-border hover:bg-muted/30">
                <TableCell className="font-bold text-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-emerald-400 font-mono font-bold">{user.balanceGB} GB</TableCell>
                <TableCell className="text-amber-400 font-mono font-bold">{user.hivePoints} PTS</TableCell>
                <TableCell>
                  {user.twoFactorEnabled ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">2FA ATIVO</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border">2FA DESATIVADO</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(user)} className="border-border">
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(user.id)} className="border-destructive/30 hover:bg-destructive/10 text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Editar Perfil do Usuário
            </DialogTitle>
          </DialogHeader>

          {editingUser && (
            <div className="grid gap-4 py-2">
              {/* Gravatar Preview Header */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://gravatar.com/avatar/${editingUser.email}?d=robohash&s=80`}
                  alt="Avatar"
                  className="w-12 h-12 rounded-full border border-primary/30"
                />
                <div>
                  <p className="text-sm font-bold text-foreground">{editingUser.email}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>ID: {editingUser.id.split("-")[0]}...</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Cargo (Role)</label>
                  <select
                    className="flex h-11 w-full rounded-xl border border-border bg-muted px-4 text-sm font-medium text-foreground outline-none"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="CUSTOMER">CUSTOMER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Segurança 2FA</label>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, twoFactorEnabled: !editForm.twoFactorEnabled })}
                    className={`h-11 px-4 rounded-xl text-xs font-bold transition-all border ${
                      editForm.twoFactorEnabled
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {editForm.twoFactorEnabled ? "2FA Habilitado" : "2FA Desabilitado"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Saldo (GB)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editForm.balanceGB}
                    onChange={(e) => setEditForm({ ...editForm, balanceGB: parseFloat(e.target.value) || 0 })}
                    className="bg-muted border-border font-mono font-bold"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">HivePoints (PTS)</label>
                  <Input
                    type="number"
                    step="1"
                    value={editForm.hivePoints}
                    onChange={(e) => setEditForm({ ...editForm, hivePoints: parseFloat(e.target.value) || 0 })}
                    className="bg-muted border-border font-mono font-bold text-amber-400"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                  Carteira Web3 (Wallet Address)
                </label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={editForm.walletAddress}
                  onChange={(e) => setEditForm({ ...editForm, walletAddress: e.target.value })}
                  className="bg-muted border-border font-mono text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground font-bold">
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
