"use client";

import { useState, useEffect } from "react";
import { Zap, Activity, Save, CheckCircle2, DollarSign, ShieldCheck, Crown, Rocket, Building2, Package, Gauge, Edit3, X, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  slug: string;
  name: string;
  category: string;
  priceInCents: number;
  maxDevices: number;
  maxProxies: number;
  gbIncluded: number;
  gbPriceCents: number;
  isRecurring: boolean;
  billingCycle: string | null;
  isPublic: boolean;
  isAdminOnly: boolean;
  extraDeviceCents: number;
  extraProxyCents: number;
  minMonthsForPPU: number;
  minAvgGbForPPU: number;
  abacateProductId: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "Acesso Geral",
  PRIVATE_FLEET: "Frota Privada (Assinatura)",
  GLOBAL_FLEET: "Frota Global (Pacotes GB)",
  PAY_PER_USE: "Pagamento por Uso",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  GENERAL: <Crown className="w-5 h-5 text-amber-400" />,
  PRIVATE_FLEET: <Rocket className="w-5 h-5 text-blue-400" />,
  GLOBAL_FLEET: <Package className="w-5 h-5 text-emerald-400" />,
  PAY_PER_USE: <Gauge className="w-5 h-5 text-purple-400" />,
};

export default function AdminPlansPage() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/plans");
      const data = await res.json();
      if (data.success) setPlans(data.data.plans);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editingPlan) return;
    setSaving(true);
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editingPlan, applyToExisting }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Plano "${editingPlan.name}" atualizado!`);
        setEditingPlan(null);
        fetchPlans();
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleSyncAbacatePay = async () => {
    setSyncing(true);
    try {
      // Chamar a API para sincronizar produtos com AbacatePay
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_abacatepay" }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Planos sincronizados com AbacatePay!");
        fetchPlans();
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setSyncing(false);
  };

  const formatCurrency = (cents: number) => {
    if (cents === 0) return "Grátis";
    return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
  };

  const formatLimit = (val: number) => (val === 0 ? "∞" : val.toString());

  const groupedPlans = plans.reduce(
    (acc, plan) => {
      const cat = plan.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(plan);
      return acc;
    },
    {} as Record<string, Plan[]>
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in pb-10 max-w-6xl">
        <div className="h-8 w-64 bg-muted/50 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Zap className="text-amber-500 w-8 h-8" />
            Planos & Preços
          </h1>
          <p className="text-base text-muted-foreground mt-2 font-medium">
            Gerencie os {plans.length} planos do sistema. Edite valores, limites e sincronize com o AbacatePay.
          </p>
        </div>
        <Button
          onClick={handleSyncAbacatePay}
          disabled={syncing}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sync AbacatePay"}
        </Button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111114] border border-[#27272e] rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                Editar: {editingPlan.name}
              </h2>
              <button onClick={() => setEditingPlan(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Nome do Plano</label>
                <Input
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="bg-muted border-border mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Preço (centavos)</label>
                <Input
                  type="number"
                  value={editingPlan.priceInCents}
                  onChange={(e) => setEditingPlan({ ...editingPlan, priceInCents: parseInt(e.target.value) || 0 })}
                  className="bg-muted border-border mt-1 font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{formatCurrency(editingPlan.priceInCents)}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Máx. Aparelhos (0=∞)</label>
                <Input
                  type="number"
                  value={editingPlan.maxDevices}
                  onChange={(e) => setEditingPlan({ ...editingPlan, maxDevices: parseInt(e.target.value) || 0 })}
                  className="bg-muted border-border mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Máx. Proxies (0=∞)</label>
                <Input
                  type="number"
                  value={editingPlan.maxProxies}
                  onChange={(e) => setEditingPlan({ ...editingPlan, maxProxies: parseInt(e.target.value) || 0 })}
                  className="bg-muted border-border mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">GB Incluído</label>
                <Input
                  type="number"
                  step="0.5"
                  value={editingPlan.gbIncluded}
                  onChange={(e) => setEditingPlan({ ...editingPlan, gbIncluded: parseFloat(e.target.value) || 0 })}
                  className="bg-muted border-border mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Preço por GB (centavos)</label>
                <Input
                  type="number"
                  value={editingPlan.gbPriceCents}
                  onChange={(e) => setEditingPlan({ ...editingPlan, gbPriceCents: parseInt(e.target.value) || 0 })}
                  className="bg-muted border-border mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Aparelho Extra (centavos)</label>
                <Input
                  type="number"
                  value={editingPlan.extraDeviceCents}
                  onChange={(e) => setEditingPlan({ ...editingPlan, extraDeviceCents: parseInt(e.target.value) || 0 })}
                  className="bg-muted border-border mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Proxy Extra (centavos)</label>
                <Input
                  type="number"
                  value={editingPlan.extraProxyCents}
                  onChange={(e) => setEditingPlan({ ...editingPlan, extraProxyCents: parseInt(e.target.value) || 0 })}
                  className="bg-muted border-border mt-1 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <button
                type="button"
                onClick={() => setApplyToExisting(!applyToExisting)}
                className="text-amber-400"
              >
                {applyToExisting ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-gray-500" />}
              </button>
              <div>
                <p className="text-sm font-bold text-foreground">Aplicar a usuários existentes</p>
                <p className="text-xs text-muted-foreground">
                  {applyToExisting ? "As mudanças serão refletidas em TODOS os assinantes." : "Mudanças só valerão para novos assinantes."}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditingPlan(null)} className="border-border">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar Plano"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Categories */}
      {Object.entries(groupedPlans).map(([category, categoryPlans]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-2">
            {CATEGORY_ICONS[category]}
            {CATEGORY_LABELS[category] || category}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryPlans.map((plan) => (
              <Card key={plan.id} className={`border-border bg-card/40 relative overflow-hidden transition-all hover:border-amber-500/30 ${plan.slug === "founder" ? "border-amber-500/50 bg-amber-500/5" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {plan.slug === "founder" && <Crown className="w-4 h-4 text-amber-400" />}
                      {plan.slug === "starter" && <ShieldCheck className="w-4 h-4 text-blue-400" />}
                      {plan.slug === "pro" && <Rocket className="w-4 h-4 text-emerald-400" />}
                      {plan.slug === "enterprise" && <Building2 className="w-4 h-4 text-purple-400" />}
                      {plan.category === "GLOBAL_FLEET" && <Package className="w-4 h-4 text-emerald-400" />}
                      {plan.category === "PAY_PER_USE" && <Gauge className="w-4 h-4 text-purple-400" />}
                      {plan.name}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {!plan.isPublic && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Oculto</Badge>}
                      {plan.isAdminOnly && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Admin</Badge>}
                      {plan.abacateProductId && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Sync</Badge>}
                    </div>
                  </div>
                  <CardDescription className="text-xs">{plan.slug}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-black text-foreground">
                    {formatCurrency(plan.priceInCents)}
                    {plan.isRecurring && <span className="text-xs font-normal text-muted-foreground">/mês</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {plan.maxDevices > 0 || plan.slug === "founder" ? (
                      <div className="bg-muted/30 p-2 rounded-lg">
                        <span className="text-muted-foreground">Aparelhos</span>
                        <p className="font-bold text-foreground">{formatLimit(plan.maxDevices)}</p>
                      </div>
                    ) : null}
                    {plan.maxProxies > 0 || plan.slug === "founder" ? (
                      <div className="bg-muted/30 p-2 rounded-lg">
                        <span className="text-muted-foreground">Proxies</span>
                        <p className="font-bold text-foreground">{formatLimit(plan.maxProxies)}</p>
                      </div>
                    ) : null}
                    {plan.gbIncluded > 0 && (
                      <div className="bg-muted/30 p-2 rounded-lg">
                        <span className="text-muted-foreground">GB</span>
                        <p className="font-bold text-foreground">{plan.gbIncluded} GB</p>
                      </div>
                    )}
                    {plan.gbPriceCents > 0 && (
                      <div className="bg-muted/30 p-2 rounded-lg">
                        <span className="text-muted-foreground">R$/GB</span>
                        <p className="font-bold text-foreground">{formatCurrency(plan.gbPriceCents)}</p>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => setEditingPlan(plan)}
                    size="sm"
                    className="w-full mt-2 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Editar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
