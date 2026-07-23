"use client";

import { useState, useEffect } from "react";
import { Zap, Activity, Save, CheckCircle2, DollarSign, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminPlansPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [pricing, setPricing] = useState({
    residentialGbPrice: 5.0,
    mobileGbPrice: 2.5,
    byodMonthlyPrice: 19.9,
    minDepositGb: 10,
  });

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.settings?.pricing) {
          setPricing(data.data.settings.pricing);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Preços e planos atualizados com sucesso!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin text-amber-500"><Activity size={48} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10 max-w-4xl">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          <Zap className="text-amber-500 w-8 h-8" />
          Configurações de Planos & Preços
        </h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">
          Defina os valores cobrados por Gigabyte transferido na rede e regras de assinatura BYOD.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tráfego Residencial SOCKS5 */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Tráfego Residencial (SOCKS5)
              </CardTitle>
              <CardDescription>Valor cobrado por GB consumido de nós residenciais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Preço por GB (R$)</label>
              <Input
                type="number"
                step="0.10"
                value={pricing.residentialGbPrice}
                onChange={(e) => setPricing({ ...pricing, residentialGbPrice: parseFloat(e.target.value) || 0 })}
                className="bg-muted border-border text-lg font-bold font-mono"
              />
            </CardContent>
          </Card>

          {/* Tráfego Mobile BYOD */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-400" />
                Tráfego Mobile (BYOD)
              </CardTitle>
              <CardDescription>Valor cobrado por GB consumido de aparelhos celulares.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Preço por GB (R$)</label>
              <Input
                type="number"
                step="0.10"
                value={pricing.mobileGbPrice}
                onChange={(e) => setPricing({ ...pricing, mobileGbPrice: parseFloat(e.target.value) || 0 })}
                className="bg-muted border-border text-lg font-bold font-mono"
              />
            </CardContent>
          </Card>

          {/* Assinatura Mensal BYOD */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Assinatura Mensal BYOD
              </CardTitle>
              <CardDescription>Valor mensal fixo para manter nós móveis dedicados ativos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Mensalidade Fixo (R$)</label>
              <Input
                type="number"
                step="1.00"
                value={pricing.byodMonthlyPrice}
                onChange={(e) => setPricing({ ...pricing, byodMonthlyPrice: parseFloat(e.target.value) || 0 })}
                className="bg-muted border-border text-lg font-bold font-mono"
              />
            </CardContent>
          </Card>

          {/* Recarga Mínima em GB */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Recarga Mínima (GB)
              </CardTitle>
              <CardDescription>Quantidade mínima de tráfego na compra rápida de saldo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Mínimo em Gigabytes</label>
              <Input
                type="number"
                step="1"
                value={pricing.minDepositGb}
                onChange={(e) => setPricing({ ...pricing, minDepositGb: parseInt(e.target.value) || 0 })}
                className="bg-muted border-border text-lg font-bold font-mono"
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="h-12 px-8 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-base flex items-center gap-2">
            <Save className="w-5 h-5" />
            {saving ? "Salvando..." : "Salvar Configurações de Preços"}
          </Button>
        </div>
      </form>
    </div>
  );
}
