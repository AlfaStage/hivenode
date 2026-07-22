"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Activity, Users, Server, HardDrive } from "lucide-react";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminNodesTab } from "@/components/admin/AdminNodesTab";
import { AdminProxiesTab } from "@/components/admin/AdminProxiesTab";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "nodes" | "proxies">("overview");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin"); // Cookie is automatically sent
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center">
        <div className="animate-spin text-amber-500"><Activity size={48} /></div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Visão Geral", icon: <Activity size={18} /> },
    { id: "users", label: "Usuários", icon: <Users size={18} /> },
    { id: "nodes", label: "Aparelhos", icon: <Server size={18} /> },
    { id: "proxies", label: "Proxies", icon: <HardDrive size={18} /> },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-300 font-sans p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#27272e] pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="text-amber-500" size={32} />
              Master Admin Panel
            </h1>
            <p className="text-slate-400 mt-2">Gestão Completa do Ecossistema HiveNode.</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                ${activeTab === tab.id 
                  ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]" 
                  : "bg-[#111114] text-slate-400 border border-[#27272e] hover:bg-[#1a1a20] hover:text-white"
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="pt-4">
          {activeTab === "overview" && <AdminOverview users={users} />}
          {activeTab === "users" && <AdminUsersTab users={users} onUpdate={fetchData} />}
          {activeTab === "nodes" && <AdminNodesTab users={users} onUpdate={fetchData} />}
          {activeTab === "proxies" && <AdminProxiesTab users={users} onUpdate={fetchData} />}
        </div>

      </div>
    </div>
  );
}
