"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "react-qr-code";
import { 
  Shield, Plus, Activity, HardDrive, 
  Eye, EyeOff, TerminalSquare, QrCode, Trash2, Copy,
  Wifi, Signal, Battery, Clock, Tag, Info, ArrowDown, ArrowUp
} from "lucide-react";

type Node = {
  id: string;
  deviceName: string;
  deviceModel?: string;
  status: string;
  createdAt: string;
  tags?: string[];
};

type Proxy = {
  id: string;
  proxyUser: string;
  proxyPass: string;
  totalBytesRx: number;
  totalBytesTx: number;
  status: string;
  node: Node;
};

export default function ProxiesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState("");
  
  // Forms
  const [selectedNode, setSelectedNode] = useState("");
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [creating, setCreating] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const [isDeleteProxyOpen, setIsDeleteProxyOpen] = useState(false);
  const [proxyToDelete, setProxyToDelete] = useState<string | null>(null);
  const [isRenameNodeOpen, setIsRenameNodeOpen] = useState(false);
  const [nodeToRename, setNodeToRename] = useState<string | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [openCopyPopover, setOpenCopyPopover] = useState<string | null>(null);
  const [openDetailsPopover, setOpenDetailsPopover] = useState<string | null>(null);
  
  const [isEditTagsOpen, setIsEditTagsOpen] = useState(false);
  const [nodeToEditTags, setNodeToEditTags] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const togglePasswordVisibility = (id: string) => {
    const newSet = new Set(visiblePasswords);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setVisiblePasswords(newSet);
  };
  
  // Telemetria ao vivo dos aparelhos conectados
  const [nodeTelemetry, setNodeTelemetry] = useState<Record<string, {ip?: string, network?: string, battery?: number, uptime?: number, rx?: number, tx?: number, latency?: number}>>({});
  
  // O Log Context define se estamos vendo logs globais (celular) ou locais (proxy)
  const [logContext, setLogContext] = useState<{type: "node" | "proxy", title: string, id: string} | null>(null);
  const [liveLogs, setLiveLogs] = useState<{id?: string, time: string, msg: string, nodeId: string}[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const proxyRes = await fetch("/api/proxies");
      const proxyData = await proxyRes.json();
      if (proxyRes.ok) setProxies(proxyData.data.proxies || []);

      const nodeRes = await fetch("/api/nodes");
      const nodeData = await nodeRes.json();
      if (nodeRes.ok) setNodes(nodeData.data.nodes || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Conecta no WebSocket do Go Broker usando o mesmo IP que o usuário digitou na URL
    const isHttps = window.location.protocol === "https:";
    const wsProtocol = isHttps ? "wss://" : "ws://";
    const wsHost = isHttps ? "api.hivenode.alfastage.com.br" : `${window.location.hostname}:10001`;
    const ws = new WebSocket(`${wsProtocol}${wsHost}/dashboard-stream`);
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "NODE_ONLINE") {
          setNodes(prev => prev.map(n => n.id === msg.nodeId ? { ...n, status: "ONLINE" } : n));
        } else if (msg.type === "NODE_OFFLINE") {
          setNodes(prev => prev.map(n => n.id === msg.nodeId ? { ...n, status: "OFFLINE" } : n));
        } else if (msg.type === "NODE_RENAMED") {
          const formattedName = msg.payload.startsWith("HiveNode ") ? msg.payload : `HiveNode ${msg.payload}`;
          setNodes(prev => prev.map(n => n.id === msg.nodeId ? { ...n, deviceModel: formattedName } : n));
        } else if (msg.type === "TELEMETRY") {
          setNodeTelemetry(prev => ({
            ...prev,
            [msg.nodeId]: {
              ...prev[msg.nodeId],
              ...msg.payload
            }
          }));
        } else if (msg.type === "LOG") {
        setLiveLogs(prev => [{
          id: Math.random().toString(36).substr(2, 9),
          time: msg.time,
          msg: String(msg.payload),
          nodeId: msg.nodeId
        }, ...prev].slice(0, 100)); // Guarda as últimas 100 linhas
      }
    } catch {
      // Ignora falhas de parse silenciosamente
    }
    };

    return () => ws.close();
  }, [fetchData]);

  const handleGenerateQr = async () => {
    try {
      const res = await fetch("/api/auth/qr-link");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Compressão Extrema para o QR Code Nível L ficar minúsculo
      const payload = `hivenode|${data.data.linkToken}`;
      
      setQrPayload(payload);
      setIsQrOpen(true);
    } catch (e: unknown) {
      if (e instanceof Error) alert(e.message);
    }
  };

  const handleDeleteNode = async () => {
    if (!nodeToDelete) return;
    try {
      const res = await fetch(`/api/nodes/${nodeToDelete}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setIsDeleteModalOpen(false);
      setNodeToDelete(null);
      fetchData(); // Atualiza a tabela
    } catch (e: unknown) {
      if (e instanceof Error) alert(e.message);
    }
  };

  const handleRenameNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeToRename) return;
    try {
      const res = await fetch(`/api/nodes/${nodeToRename}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName: newNodeName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setIsRenameNodeOpen(false);
      setNodeToRename(null);
      // Não chamo fetchData() porque o Broadcaster WebSocket (NODE_RENAMED) vai atualizar sozinho!
    } catch (e: unknown) {
      if (e instanceof Error) alert(e.message);
    }
  };

  const handleEditTags = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeToEditTags) return;
    try {
      const tagsArray = tagsInput.split(",").map(t => t.trim()).filter(t => t.length > 0);
      const res = await fetch(`/api/nodes/${nodeToEditTags}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: tagsArray })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setIsEditTagsOpen(false);
      setNodeToEditTags(null);
      fetchData(); 
    } catch (e: unknown) {
      if (e instanceof Error) alert(e.message);
    }
  };

  const handleDeleteProxy = async () => {
    if (!proxyToDelete) return;
    try {
      const res = await fetch(`/api/proxies/${proxyToDelete}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setIsDeleteProxyOpen(false);
      setProxyToDelete(null);
      fetchData();
    } catch (e: unknown) {
      if (e instanceof Error) alert(e.message);
    }
  };

  const handleCreateProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: selectedNode,
          proxyUser: newUser,
          proxyPass: newPass
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert("Proxy Criado e Sincronizado no Redis com Sucesso!");
      setIsCreateOpen(false);
      setNewUser("");
      setNewPass("");
      fetchData();
    } catch (e: unknown) {
      if (e instanceof Error) alert(e.message);
    }
    setCreating(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setOpenCopyPopover(null);
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#111114] p-6 border border-[#27272e] rounded-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">SOCKS5 Proxies</h1>
            <p className="text-[#8e8e99] mt-1">
              Gerencie suas credenciais de proxy e vincule-as aos seus celulares na rede.
            </p>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Proxy SOCKS5
        </button>
      </div>

      {/* Como Conectar - Instruções */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
        <h2 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
          <TerminalSquare className="w-5 h-5" />
          Como utilizar na sua máquina
        </h2>
        <p className="text-[#8e8e99] mb-4">
          Para rotear seu tráfego, configure o seu navegador ou sistema operacional usando as credenciais abaixo e aponte para o nosso Broker na porta 10000.
        </p>
        <code className="bg-[#0a0a0c] text-emerald-300 p-3 rounded-lg block border border-emerald-500/30">
          socks5://usuario:senha@hivenode.alfastage.com.br:10000
        </code>
      </div>

      {/* Lista de Aparelhos (Nodes BYOD) */}
      <div className="bg-[#111114] border border-[#27272e] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-[#27272e] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-500" />
            Meus Aparelhos Conectados
          </h2>
          <button 
            type="button"
            onClick={handleGenerateQr}
            className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            <QrCode className="w-4 h-4" />
            Vincular App (QR Code)
          </button>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-[#8e8e99]">Buscando aparelhos...</div>
        ) : nodes.length === 0 ? (
          <div className="p-8 text-center text-[#8e8e99]">Nenhum aparelho Android vinculado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#0a0a0c] text-[#8e8e99] text-sm uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">Aparelho</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Rede</th>
                  <th className="px-6 py-4 font-medium">IP Externo</th>
                  <th className="px-6 py-4 font-medium">Banda Larga</th>
                  <th className="px-6 py-4 font-medium">Tags</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272e]">
                {nodes.map(n => (
                  <tr key={n.id} className="hover:bg-[#1a1a20] transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-white">
                        {(n.deviceModel || n.deviceName).startsWith("HiveNode ") ? (n.deviceModel || n.deviceName) : `HiveNode ${n.deviceModel || n.deviceName}`}
                      </div>
                      <div className="text-xs mt-1 text-[#8e8e99] font-mono">
                        {n.id.split("-")[0]}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {n.status === "ONLINE" ? (
                        <span className="text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full text-xs font-bold border border-emerald-400/20">Online</span>
                      ) : (
                        <span className="text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/20">Desconectado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-[#f0f0f2]">
                        <Wifi className="w-4 h-4 text-blue-400" />
                        {nodeTelemetry[n.id]?.network || "---"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#8e8e99] font-mono text-sm">
                      {nodeTelemetry[n.id]?.ip || "---.---.---.---"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs font-mono">
                        <span className="text-emerald-400 flex items-center gap-1"><ArrowDown className="w-3 h-3"/> {formatBytes(nodeTelemetry[n.id]?.rx || 0)}</span>
                        <span className="text-blue-400 flex items-center gap-1"><ArrowUp className="w-3 h-3"/> {formatBytes(nodeTelemetry[n.id]?.tx || 0)}</span>
                        <span className="text-amber-500 flex items-center gap-1"><Activity className="w-3 h-3"/> {nodeTelemetry[n.id]?.latency || 0}ms</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {n.tags && n.tags.length > 0 ? n.tags.map(tag => (
                          <span key={tag} className="text-xs bg-[#27272e] text-[#8e8e99] px-2 py-0.5 rounded-md border border-[#3e3e4a]">
                            {tag}
                          </span>
                        )) : <span className="text-xs text-[#8e8e99] opacity-50">Sem tags</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 relative">
                        <div className="relative">
                          <button 
                            type="button"
                            onClick={() => setOpenDetailsPopover(openDetailsPopover === n.id ? null : n.id)}
                            className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                            title="Detalhes do Aparelho"
                          >
                            <Info className="w-5 h-5" />
                          </button>
                          {openDetailsPopover === n.id && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1a20] border border-[#27272e] rounded-lg shadow-xl z-10 overflow-hidden text-left p-4">
                              <h3 className="text-white font-bold mb-3 text-sm">Detalhes do Sistema</h3>
                              <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-[#8e8e99] flex items-center gap-2"><Clock className="w-4 h-4"/> Uptime</span>
                                  <span className="text-white font-mono">{nodeTelemetry[n.id]?.uptime ? `${Math.floor(nodeTelemetry[n.id].uptime! / 60)}m` : "---"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[#8e8e99] flex items-center gap-2"><Battery className="w-4 h-4"/> Bateria</span>
                                  <span className="text-white font-mono">{nodeTelemetry[n.id]?.battery ? `${Math.floor(nodeTelemetry[n.id].battery! * 100)}%` : "---"}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-[#27272e] pt-3 mt-3">
                                  <span className="text-[#8e8e99] flex items-center gap-2">Vínculo</span>
                                  <span className="text-white font-mono text-xs">{new Date(n.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            setNodeToEditTags(n.id);
                            setTagsInput((n.tags || []).join(", "));
                            setIsEditTagsOpen(true);
                          }}
                          className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Editar Tags"
                        >
                          <Tag className="w-5 h-5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setLogContext({ type: "node", title: `Aparelho ${n.deviceModel || n.deviceName}`, id: n.id })}
                          className="p-2 text-[#8e8e99] hover:bg-[#27272e] rounded-lg transition-colors"
                          title="Ver Logs Globais do Aparelho"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                          const originalName = (n.deviceModel || n.deviceName).replace(/^HiveNode /, "");
                          setNodeToRename(n.id); 
                          setNewNodeName(originalName); 
                          setIsRenameNodeOpen(true); 
                        }}
                          className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Renomear Aparelho"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                          </svg>
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setNodeToDelete(n.id); setIsDeleteModalOpen(true); }}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Desvincular Aparelho"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lista de Proxies (Toll Booth) */}
      <div className="bg-[#111114] border border-[#27272e] rounded-xl overflow-visible">
        <div className="p-6 border-b border-[#27272e]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-500" />
            Credenciais e Consumo (GB)
          </h2>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-[#8e8e99]">Carregando tráfego do servidor...</div>
        ) : proxies.length === 0 ? (
          <div className="p-12 text-center text-[#8e8e99]">
            Você ainda não possui Proxies criados. Clique em "Novo Proxy SOCKS5" acima.
          </div>
        ) : (
          <div className="overflow-visible pb-20">
            <table className="w-full text-left">
              <thead className="bg-[#0a0a0c] text-[#8e8e99] text-sm uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">Usuário</th>
                  <th className="px-6 py-4 font-medium">Senha</th>
                  <th className="px-6 py-4 font-medium">Roteador (Aparelho)</th>
                  <th className="px-6 py-4 font-medium">Download (RX)</th>
                  <th className="px-6 py-4 font-medium">Upload (TX)</th>
                  <th className="px-6 py-4 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272e]">
                {proxies.map(p => (
                  <tr key={p.id} className="hover:bg-[#1a1a20] transition-colors">
                    <td className="px-6 py-4 text-white font-medium">{p.proxyUser}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[#8e8e99]">
                        {visiblePasswords.has(p.id) ? p.proxyPass : "••••••••"}
                        <button 
                          onClick={() => togglePasswordVisibility(p.id)} 
                          className="hover:text-amber-500 hover:bg-amber-500/10 p-1 rounded transition-colors"
                          title="Mostrar/Esconder Senha"
                        >
                          {visiblePasswords.has(p.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full text-xs font-bold w-max">
                        <HardDrive className="w-3 h-3" />
                        {(p.node?.deviceModel || p.node?.deviceName)?.startsWith("HiveNode ") 
                          ? (p.node?.deviceModel || p.node?.deviceName) 
                          : (p.node?.deviceModel ? `HiveNode ${p.node.deviceModel}` : "Aparelho Removido")
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4 text-blue-400 font-bold">{formatBytes(p.totalBytesRx)}</td>
                    <td className="px-6 py-4 text-emerald-400 font-bold">{formatBytes(p.totalBytesTx)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 relative">
                        <div className="relative">
                          <button 
                            type="button"
                            onClick={() => setOpenCopyPopover(openCopyPopover === p.id ? null : p.id)}
                            className="text-blue-400 hover:bg-blue-400/10 rounded-lg p-2 transition-colors"
                            title="Copiar Credenciais"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                          {openCopyPopover === p.id && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a20] border border-[#27272e] rounded-lg shadow-xl z-10 overflow-hidden text-left">
                              <button type="button" onClick={() => handleCopy(`socks5://${p.proxyUser}:${p.proxyPass}@${window.location.hostname}:10000`)} className="block w-full text-left px-4 py-3 text-sm text-[#f0f0f2] hover:bg-[#27272e] border-b border-[#27272e]">Copiar URL SOCKS5</button>
                              <button type="button" onClick={() => handleCopy(p.proxyUser)} className="block w-full text-left px-4 py-2 text-sm text-[#f0f0f2] hover:bg-[#27272e]">Copiar Usuário</button>
                              <button type="button" onClick={() => handleCopy(p.proxyPass)} className="block w-full text-left px-4 py-2 text-sm text-[#f0f0f2] hover:bg-[#27272e]">Copiar Senha</button>
                              <button type="button" onClick={() => handleCopy(window.location.hostname)} className="block w-full text-left px-4 py-2 text-sm text-[#f0f0f2] hover:bg-[#27272e]">Copiar Endereço</button>
                              <button type="button" onClick={() => handleCopy("10000")} className="block w-full text-left px-4 py-2 text-sm text-[#f0f0f2] hover:bg-[#27272e]">Copiar Porta</button>
                            </div>
                          )}
                        </div>
                        <button 
                          type="button"
                          onClick={() => setLogContext({ type: "proxy", title: `Credencial ${p.proxyUser}`, id: p.node?.id || "" })}
                          className="text-[#8e8e99] hover:bg-[#27272e] rounded-lg p-2 transition-colors"
                          title="Ver Logs Específicos Desta Credencial"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setProxyToDelete(p.id); setIsDeleteProxyOpen(true); }}
                          className="text-rose-500 hover:bg-rose-500/10 rounded-lg p-2 transition-colors"
                          title="Excluir Proxy"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar Proxy */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#111114] border border-[#27272e] rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-6">Nova Credencial Proxy</h2>
            <form onSubmit={handleCreateProxy} className="space-y-4">
              <div>
                <label htmlFor="nodeSelect" className="block text-[#8e8e99] text-sm mb-2">Vincular a qual Aparelho?</label>
                <select 
                  id="nodeSelect"
                  required
                  title="Selecione o Aparelho"
                  value={selectedNode}
                  onChange={e => setSelectedNode(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#27272e] rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Selecione um celular...</option>
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.deviceName} (ID: {n.id.split('-')[0]})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="proxyUser" className="block text-[#8e8e99] text-sm mb-2">Usuário SOCKS5</label>
                <input 
                  id="proxyUser"
                  required
                  type="text"
                  placeholder="Ex: alfastage"
                  value={newUser}
                  onChange={e => setNewUser(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#27272e] rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="proxyPass" className="block text-[#8e8e99] text-sm mb-2">Senha SOCKS5</label>
                <input 
                  id="proxyPass"
                  required
                  type="text"
                  placeholder="Sua senha segura"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#27272e] rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setIsCreateOpen(false)}
                  className="px-5 py-3 text-[#8e8e99] hover:text-white"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={creating}
                  className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold"
                >
                  {creating ? "Sincronizando..." : "Criar e Ativar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {isQrOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111114] border border-[#27272e] rounded-xl w-full max-w-sm p-6 text-center">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-500" />
                Vincular Dispositivo
              </h2>
              <button type="button" onClick={() => setIsQrOpen(false)} className="text-[#8e8e99] hover:text-white">✕</button>
            </div>
            
            <p className="text-[#8e8e99] text-sm mb-6">
              Abra o HiveNode Mobile e escaneie este código para vincular automaticamente, sem digitar senhas!
            </p>
            
            <div className="bg-white p-4 rounded-xl inline-block mb-6">
              <QRCode value={qrPayload} size={200} level="H" />
            </div>
          </div>
        </div>
      )}

      {/* Modal Logs Remotos via WebSocket */}
      {logContext && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111114] border border-[#27272e] rounded-xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TerminalSquare className="w-5 h-5 text-amber-500" />
                Logs Remotos ({logContext.title})
              </h2>
              <button type="button" onClick={() => setLogContext(null)} className="text-[#8e8e99] hover:text-white">✕</button>
            </div>
            
            <div className="bg-[#0a0a0c] p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto border border-[#27272e]">
              <div className="text-[#8e8e99] mb-4 pb-2 border-b border-[#27272e]">
                <span className="text-emerald-400">✅ Filtro Ativo para: {logContext.type === "node" ? "Todo o Aparelho (Mestre)" : "Somente Proxy Específico"}</span>
              </div>
              
              {liveLogs.filter(l => l.nodeId === logContext.id).length === 0 ? (
                <div className="text-[#4b4b57] text-center mt-10">Aguardando novo tráfego...</div>
              ) : (
                liveLogs.filter(l => l.nodeId === logContext.id).map((log) => (
                  <div key={log.id} className="text-[#8e8e99] mb-1">
                    <span className="text-[#4b4b57]">[{log.time}]</span> <span className="text-emerald-300">{log.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão de Aparelho */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111114] border border-[#27272e] rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-rose-500" />
              Remover Aparelho?
            </h2>
            <p className="text-[#8e8e99] mb-6">
              Tem certeza que deseja apagar este celular da rede? A conexão VPN dele cairá <b>imediatamente</b> e você precisará ler o QR Code de novo se quiser voltar.
            </p>
            
            <div className="flex gap-4 mt-8">
              <button 
                type="button"
                onClick={() => { setIsDeleteModalOpen(false); setNodeToDelete(null); }}
                className="flex-1 px-4 py-3 bg-[#1a1a20] hover:bg-[#27272e] text-white rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteNode}
                className="flex-1 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors"
              >
                Sim, Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Renomear Aparelho */}
      {isRenameNodeOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111114] border border-[#27272e] rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <title>Renomear</title>
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              </svg>
              Renomear Aparelho
            </h2>
            <form onSubmit={handleRenameNode}>
              <div className="mb-6">
                <label htmlFor="renameInput" className="block text-[#8e8e99] text-sm mb-2">Novo Nome</label>
                <div className="flex bg-[#0a0a0c] border border-[#27272e] rounded-lg overflow-hidden focus-within:border-blue-500">
                  <span className="px-4 py-3 bg-[#1a1a20] text-[#8e8e99] border-r border-[#27272e] font-medium">HiveNode</span>
                  <input 
                    id="renameInput"
                    required
                    type="text"
                    placeholder=" Ex: Meu Celular"
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    className="w-full bg-transparent px-4 py-3 text-white focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => { setIsRenameNodeOpen(false); setNodeToRename(null); }}
                  className="flex-1 px-4 py-3 bg-[#1a1a20] hover:bg-[#27272e] text-white rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Editar Tags */}
      {isEditTagsOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111114] border border-[#27272e] rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Tag className="w-6 h-6 text-amber-500" />
              Editar Tags do Aparelho
            </h2>
            <form onSubmit={handleEditTags}>
              <div className="mb-6">
                <label className="block text-[#8e8e99] text-sm mb-2">Tags (Separadas por vírgula)</label>
                <input 
                  type="text"
                  placeholder="Ex: Claro 5G, SP, Backup..."
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#27272e] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => { setIsEditTagsOpen(false); setNodeToEditTags(null); }}
                  className="flex-1 px-4 py-3 bg-[#1a1a20] hover:bg-[#27272e] text-white rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                >
                  Salvar Tags
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão de Proxy */}
      {isDeleteProxyOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111114] border border-[#27272e] rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-rose-500" />
              Apagar Credencial Proxy?
            </h2>
            <p className="text-[#8e8e99] mb-6">
              Tem certeza que deseja excluir este Proxy SOCKS5? Qualquer pessoa conectada com essa senha cairá <b>imediatamente</b> pois o cache será revogado do Redis.
            </p>
            
            <div className="flex gap-4 mt-8">
              <button 
                type="button"
                onClick={() => { setIsDeleteProxyOpen(false); setProxyToDelete(null); }}
                className="flex-1 px-4 py-3 bg-[#1a1a20] hover:bg-[#27272e] text-white rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteProxy}
                className="flex-1 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors"
              >
                Sim, Apagar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
