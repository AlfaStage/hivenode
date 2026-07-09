"use client";

import { CreditCard, ArrowRight, Zap, ShieldCheck } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie seu saldo e assinaturas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="glass rounded-2xl p-6 lg:col-span-2 border border-border relative overflow-hidden">
          {/* Decoração */}
          <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Saldo Disponível (Pré-pago)</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold text-foreground">0.00</span>
                <span className="text-xl font-medium text-muted-foreground">GB</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-success" />
                Seu consumo é debitado automaticamente.
              </p>
            </div>
            
            <button className="h-12 px-6 rounded-xl bg-foreground text-background font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all duration-200 cursor-pointer whitespace-nowrap">
              <CreditCard className="w-5 h-5" />
              Adicionar Saldo
            </button>
          </div>
        </div>

        {/* Current Plan */}
        <div className="glass rounded-2xl p-6 border border-border flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Plano Atual</h3>
          </div>
          
          <div className="flex-1">
            <p className="text-xl font-bold text-foreground">Premium Metered</p>
            <p className="text-sm text-muted-foreground mt-1">Pago por Gigabyte transferido.</p>
          </div>
          
          <div className="mt-6 pt-6 border-t border-border">
            <button className="text-sm font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors">
              Ver histórico de faturas <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Table Placeholder */}
      <div className="mt-12">
        <h3 className="text-lg font-semibold text-foreground mb-4">Tabela de Preços</h3>
        <div className="glass rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <span className="text-foreground font-medium">Tráfego Residencial (SOCKS5)</span>
            <span className="text-foreground">R$ 5,00 / GB</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-foreground font-medium">Tráfego Mobile (BYOD)</span>
            <span className="text-foreground">R$ 2,50 / GB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
