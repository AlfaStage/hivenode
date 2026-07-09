"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Server, Shield, CreditCard } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
    { href: "/dashboard/proxies", label: "Meus Proxies", icon: Shield },
    { href: "/dashboard/billing", label: "Faturamento", icon: CreditCard },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 border-r border-border bg-card/30 backdrop-blur-xl p-5">
      <div className="flex items-center gap-4 px-3 mb-10 mt-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
          <span className="text-lg font-black text-primary">H</span>
        </div>
        <span className="text-2xl font-black tracking-tighter text-foreground">HiveNode</span>
      </div>

      <nav className="flex-1 space-y-2">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 ${
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
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
