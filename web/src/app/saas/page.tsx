"use client";
import { useEffect, useState } from "react";
type Node = { id: string; deviceName: string; visibility: string; status: string };
type Share = { id: string; sharedWithEmail: string; status: string; ownerId: string; node: { deviceModel: string } };
export default function SaaSPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [nodeId, setNodeId] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState("");
  async function load() {
    const [n, s, me] = await Promise.all([fetch("/api/nodes").then(r => r.json()), fetch("/api/shares").then(r => r.json()), fetch("/api/auth/me").then(r => r.json())]);
    if (!n.success || !s.success || !me.success) { setMessage("Entre na sua conta para gerenciar compartilhamentos."); return; }
    setNodes(n.data.nodes.filter((node: Node) => node.visibility === "PRIVATE")); setShares(s.data.shares); setUserId(me.data.id);
  }
  useEffect(() => { void load(); }, []);
  async function update(id: string, action: string) {
    const res = await fetch("/api/shares", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    setMessage(res.ok ? "Compartilhamento atualizado" : "Não foi possível atualizar"); await load();
  }
  return <main className="max-w-4xl mx-auto p-8 space-y-6">
    <h1 className="text-3xl font-bold">Compartilhar acesso B2B</h1>
    <p>O convidado precisa ter uma conta e aceitar o convite neste painel. A propriedade do aparelho permanece com você.</p>
    <form className="flex flex-wrap gap-3" onSubmit={async event => {
      event.preventDefault();
      const response = await fetch("/api/shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nodeId, email, maxProxies: 1 }) });
      setMessage(response.ok ? "Convite disponível para o destinatário" : "Não foi possível criar convite"); await load();
    }}>
      <select aria-label="Aparelho" required value={nodeId} onChange={e => setNodeId(e.target.value)} className="border rounded p-2">
        <option value="">Selecione seu aparelho</option>{nodes.map(n => <option key={n.id} value={n.id}>{n.deviceName} — {n.status}</option>)}
      </select>
      <input aria-label="Email do Gestor" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="border rounded p-2" placeholder="Email do Gestor" />
      <button className="bg-amber-500 text-black rounded px-4">Convidar</button>
    </form>
    <p role="status">{message}</p>
    {shares.map(s => <article key={s.id} className="border rounded p-4 flex gap-4 items-center">
      <span>{s.node.deviceModel} · {s.sharedWithEmail} · {s.status}</span>
      {s.ownerId === userId && s.status !== "REVOKED" && <button onClick={() => update(s.id, "revoke")}>Revogar</button>}
      {s.ownerId !== userId && s.status === "PENDING" && <button onClick={() => update(s.id, "accept")}>Aceitar</button>}
    </article>)}
  </main>;
}
