"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Server, Activity, ChevronDown, ChevronUp, ShieldCheck, 
  Wifi, HardDrive, DollarSign, Pickaxe
} from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetch("/api/admin", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsers(data.data.users);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center">
        <div className="animate-spin text-amber-500"><Activity size={48} /></div>
      </div>
    );
  }

  const totalNodes = users.reduce((acc, u) => acc + u.nodes.length, 0);
  const totalProxies = users.reduce((acc, u) => acc + u.nodes.reduce((a: number, n: any) => a + n.proxies.length, 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-300 font-sans p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="text-amber-500" size={32} />
              Master Admin Panel
            </h1>
            <p className="text-slate-400 mt-2">Visão global do ecossistema HiveNode e HiveMiner.</p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-[#111114] border border-[#27272e] rounded-xl p-4 min-w-[120px]">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Usuários</p>
              <p className="text-2xl font-black text-white">{users.length}</p>
            </div>
            <div className="bg-[#111114] border border-[#27272e] rounded-xl p-4 min-w-[120px]">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total de Nós</p>
              <p className="text-2xl font-black text-amber-500">{totalNodes}</p>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
            <Users className="text-slate-400" size={20} /> Base de Clientes
          </h2>

          {users.map(user => (
            <div key={user.id} className="bg-[#111114] border border-[#27272e] rounded-2xl overflow-hidden transition-all">
              
              {/* User Header */}
              <div 
                className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-[#1a1a20]"
                onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Users className="text-indigo-400" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{user.email}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-4 mt-1">
                      <span>Nós: {user.nodes.length}</span>
                      <span>•</span>
                      <span className="text-emerald-400 flex items-center gap-1"><DollarSign size={14}/> {user.balanceGB} GB</span>
                      <span>•</span>
                      <span className="text-amber-400 flex items-center gap-1"><Pickaxe size={14}/> {user.hivePoints} PTS</span>
                    </p>
                  </div>
                </div>
                
                <div className="text-slate-500">
                  {expandedUserId === user.id ? <ChevronUp /> : <ChevronDown />}
                </div>
              </div>

              {/* Expanded User Details (Nodes) */}
              <AnimatePresence>
                {expandedUserId === user.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-[#27272e] bg-[#0d0d10]"
                  >
                    <div className="p-6">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Server size={16} /> Aparelhos Conectados ({user.nodes.length})
                      </h4>
                      
                      {user.nodes.length === 0 ? (
                        <p className="text-slate-600 text-sm">Este usuário não possui aparelhos registrados.</p>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {user.nodes.map((node: any) => (
                            <div key={node.id} className="bg-[#15151a] border border-[#2f2f38] rounded-xl p-5">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-bold text-white">{node.deviceModel || "Dispositivo"}</h5>
                                    {node.visibility === "PUBLIC" ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">MINER (PUBLIC)</span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">PROXY (PRIVATE)</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 font-mono">ID: {node.id}</p>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${node.status === 'ONLINE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`} />
                              </div>

                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedNodeId(expandedNodeId === node.id ? null : node.id);
                                }}
                                className="w-full text-left py-2 px-3 bg-[#1e1e24] hover:bg-[#27272e] rounded-lg text-sm text-slate-300 flex justify-between items-center transition-colors border border-transparent hover:border-[#383842]"
                              >
                                <span className="flex items-center gap-2"><HardDrive size={16}/> Ver Proxies Ativos ({node.proxies.length})</span>
                                {expandedNodeId === node.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                              </button>

                              <AnimatePresence>
                                {expandedNodeId === node.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-3 space-y-2">
                                      {node.proxies.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic p-2">Nenhum proxy gerado para este nó.</p>
                                      ) : (
                                        node.proxies.map((proxy: any) => (
                                          <div key={proxy.id} className="bg-[#111114] border border-[#27272e] p-3 rounded-lg flex justify-between items-center">
                                            <div>
                                              <p className="text-sm font-bold text-slate-200">{proxy.proxyUser}</p>
                                              <p className="text-xs text-slate-500 font-mono">Senha: {proxy.proxyPass}</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-xs text-emerald-400">Tx: {(Number(proxy.totalBytesTx) / 1024 / 1024).toFixed(2)} MB</p>
                                              <p className="text-xs text-blue-400">Rx: {(Number(proxy.totalBytesRx) / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
