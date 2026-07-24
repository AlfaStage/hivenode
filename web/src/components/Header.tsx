"use client";

import { LogOut } from "lucide-react";

export function Header({ userRole, avatarUrl, name }: { userRole: string, avatarUrl: string, name: string }) {
  return (
    <header className="h-20 border-b border-border bg-card/40 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Painel de Controle</h2>
      
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end hidden md:flex">
          <span className="text-sm font-bold text-foreground">{name}</span>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">{userRole}</span>
        </div>
        
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/30 ring-4 ring-background shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt="Avatar do Gravatar" className="w-full h-full object-cover" />
        </div>
        
        <div className="w-px h-8 bg-border mx-2"></div>
        
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="flex items-center justify-center p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 cursor-pointer"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
