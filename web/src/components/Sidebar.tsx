"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Server, Shield, CreditCard, ShieldCheck, 
  Users, Pickaxe, ChevronDown, ChevronRight, Zap, Coins, Settings 
} from "lucide-react";
import { useState, useEffect } from "react";

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Auto-open admin menu if we are in any admin sub-route
  useEffect(() => {
    if (pathname?.startsWith("/dashboard/admin")) {
      setIsAdminOpen(true);
    }
  }, [pathname]);

  const links = [
    { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
    { href: "/dashboard/miner", label: "HiveMiner", icon: Pickaxe },
    { href: "/dashboard/proxies", label: "Meus Proxies", icon: Shield },
    { href: "/dashboard/billing", label: "Faturamento", icon: CreditCard },
  ];

  const adminLinks = [
    { href: "/dashboard/admin", label: "Visão Geral", icon: LayoutDashboard },
    { href: "/dashboard/admin/users", label: "Usuários", icon: Users },
    { href: "/dashboard/admin/subscriptions", label: "Assinaturas", icon: CreditCard },
    { href: "/dashboard/admin/nodes", label: "Aparelhos", icon: Server },
    { href: "/dashboard/admin/proxies", label: "Proxies", icon: Shield },
    { href: "/dashboard/admin/plans", label: "Planos & Preços", icon: Zap },
    { href: "/dashboard/admin/crypto", label: "Crypto & Tokenomics", icon: Coins },
    { href: "/dashboard/admin/settings", label: "Configurações Gerais", icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 border-r border-border bg-card/30 backdrop-blur-xl p-5 overflow-y-auto">
      <div className="flex items-center gap-4 px-3 mb-10 mt-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
          <span className="text-lg font-black text-primary">H</span>
        </div>
        <span className="text-2xl font-black tracking-tighter text-foreground">HiveNode</span>
      </div>

      <nav className="flex-1 space-y-2">
        <div className="mb-4">
          <p className="px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Painel do Usuário</p>
          {links.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 mb-1 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon 
                  className={`w-5 h-5 transition-transform duration-300 ${
                    isActive ? "text-primary-foreground scale-110" : "text-muted-foreground group-hover:scale-110"
                  }`} 
                />
                {link.label}
                {link.href === '/dashboard/miner' && (
                  <span className="ml-auto flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
                )}
              </Link>
            );
          })}
        </div>

        {role === "ADMIN" && (
          <div className="mt-8 border-t border-border pt-4">
            <button 
              type="button"
              onClick={() => setIsAdminOpen(!isAdminOpen)}
              className="w-full group flex items-center justify-between gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 text-amber-500 hover:bg-amber-500/10 mb-2 cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <ShieldCheck className="w-5 h-5" />
                <span>Administração</span>
              </div>
              {isAdminOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {isAdminOpen && (
              <div className="pl-3 space-y-1 border-l-2 border-amber-500/30 ml-5 mt-2">
                {adminLinks.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                        isActive
                          ? "bg-amber-500 text-black shadow-md font-extrabold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
