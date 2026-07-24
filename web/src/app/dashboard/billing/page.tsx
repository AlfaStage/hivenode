"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Clock, CreditCard, Crown, ExternalLink, Gauge, Package, Rocket, ShieldCheck, XCircle, Zap } from "lucide-react";
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
  isPublic: boolean;
  isAdminOnly: boolean;
  extraDeviceCents: number;
  extraProxyCents: number;
  abacateProductId: string | null;
}

interface PaymentRecord {
  id: string;
  type: string;
  amountCents: number;
  status: string;
  createdAt: string;
  planId: string | null;
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  founder: <Crown className="w-5 h-5 text-amber-400" />,
  starter: <ShieldCheck className="w-5 h-5 text-blue-400" />,
  pro: <Rocket className="w-5 h-5 text-emerald-400" />,
  enterprise: <Building2 className="w-5 h-5 text-purple-400" />,
  "gb-basic": <Package className="w-5 h-5 text-emerald-400" />,
  "gb-intermediate": <Package className="w-5 h-5 text-blue-400" />,
  "gb-advanced": <Package className="w-5 h-5 text-amber-400" />,
  "pay-as-you-go": <Gauge className="w-5 h-5 text-purple-400" />,
};

const STATUS_BADGES: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  PAID: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Pago", icon: <CheckCircle2 className="w-3 h-3" /> },
  PENDING: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Pendente", icon: <Clock className="w-3 h-3" /> },
  FAILED: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Falhou", icon: <XCircle className="w-3 h-3" /> },
  REFUNDED: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: "Estornado", icon: <ArrowRight className="w-3 h-3" /> },
};

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [userData, setUserData] = useState<{ balanceGB: number; activePlanId: string | null; email: string; hivePoints: number; subscriptions: Subscription[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansRes, meRes] = await Promise.all([
          fetch("/api/admin/plans").then((r) => r.json()).catch(() => ({ data: { plans: [] } })),
          fetch("/api/auth/me").then((r) => r.json()),
        ]);

        if (plansRes.success || plansRes.data?.plans) {
          setPlans((plansRes.data?.plans || []).filter((p: Plan) => p.isPublic && !p.isAdminOnly));
        }
        if (meRes.success) {
          setUserData(meRes.data);
          setPayments(meRes.data.payments || []);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
     
    fetchData();
  }, []);

  const handlePurchase = async (plan: Plan) => {
    setPurchasing(plan.id);
    try {
      const endpoint = plan.isRecurring ? "/api/billing/subscribe" : "/api/billing/checkout";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, couponCode: couponCode || undefined }),
      });
      const data = await res.json();

      if (data.success && data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else {
        alert(data.error || "Erro ao processar. Verifique se o plano está configurado no gateway de pagamento.");
      }
    } catch (_e) {
      alert("Erro de conexão. Tente novamente.");
    }
    setPurchasing(null);
  };

  const formatCurrency = (cents: number) => {
    if (cents === 0) return "Grátis";
    return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
  };

  const formatLimit = (val: number) => (val === 0 ? "∞ Ilimitado" : val.toString());

  const activeSubscriptions = userData?.subscriptions || [];
  const activePlanIds = activeSubscriptions.map((s: Subscription) => s.planId).filter(Boolean);

  const privateFleet = plans.filter((p) => p.category === "PRIVATE_FLEET");
  const globalFleet = plans.filter((p) => p.category === "GLOBAL_FLEET");
  const payPerUse = plans.filter((p) => p.category === "PAY_PER_USE");

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted/50 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
        <p className="text-muted-foreground mt-1">Gerencie seus planos, pacotes, saldo e pagamentos.</p>
      </div>

      {/* Balance & Current Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 lg:col-span-2 border border-border relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Saldo Disponível (Frota Global / Miner)</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold text-foreground">{(userData?.balanceGB || 0).toFixed(2)}</span>
                <span className="text-xl font-medium text-muted-foreground">GB</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                O saldo é compartilhado entre pacotes comprados e pontos convertidos.
              </p>
            </div>
            
            {(userData?.hivePoints ?? 0) > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 min-w-[200px]">
                <p className="text-sm font-medium text-amber-500">Pontos Miner (Tokens)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-amber-400">{userData?.hivePoints?.toFixed(2) || "0.00"}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Podem ser convertidos em GB</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-border flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Assinaturas Ativas</h3>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[160px] pr-2">
            {activeSubscriptions.length > 0 ? (
              activeSubscriptions.map((sub: Subscription) => {
                const p = plans.find(plan => plan.id === sub.planId);
                if (!p) return null;
                return (
                  <div key={sub.id} className="flex items-center justify-between bg-muted/20 p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      {PLAN_ICONS[p.slug]}
                      <div>
                        <p className="text-sm font-bold text-foreground">{p.name}</p>
                        <p className="text-xs text-emerald-400">{sub.status}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <p className="text-xl font-bold text-foreground mt-2">Nenhuma</p>
                <p className="text-sm text-muted-foreground mt-1">Assine um plano abaixo para começar.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Coupon Code */}
      <div className="glass rounded-2xl p-4 border border-border flex items-center gap-4">
        <CreditCard className="w-5 h-5 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Tem um cupom de desconto? Cole aqui..."
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground flex-1 font-mono"
        />
        {couponCode && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold">
            {couponCode}
          </Badge>
        )}
      </div>

      {/* Private Fleet Plans */}
      {privateFleet.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-400" />
            Frota Privada (Use seus próprios aparelhos)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {privateFleet.map((plan) => (
              <div
                key={plan.id}
                className={`glass rounded-2xl p-6 border transition-all hover:shadow-lg ${
                  activePlanIds.includes(plan.id)
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {PLAN_ICONS[plan.slug]}
                  <h4 className="text-lg font-bold text-foreground">{plan.name}</h4>
                  {activePlanIds.includes(plan.id) && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Ativo</Badge>
                  )}
                </div>

                <div className="text-3xl font-black text-foreground mb-1">
                  {formatCurrency(plan.priceInCents)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </div>

                <div className="space-y-2 mt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aparelhos</span>
                    <span className="font-bold text-foreground">{formatLimit(plan.maxDevices)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proxies</span>
                    <span className="font-bold text-foreground">{formatLimit(plan.maxProxies)}</span>
                  </div>
                  {plan.extraDeviceCents > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Aparelho adicional</span>
                      <span className="text-foreground">{formatCurrency(plan.extraDeviceCents)}/mês</span>
                    </div>
                  )}
                  {plan.extraProxyCents > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Proxy adicional</span>
                      <span className="text-foreground">{formatCurrency(plan.extraProxyCents)}/mês</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tráfego</span>
                    <span className="font-bold text-emerald-400">Ilimitado</span>
                  </div>
                </div>

                <Button
                  onClick={() => handlePurchase(plan)}
                  disabled={purchasing === plan.id || activePlanIds.includes(plan.id)}
                  className="w-full mt-6 h-12 bg-foreground text-background font-bold gap-2"
                >
                  {purchasing === plan.id ? (
                    "Redirecionando..."
                  ) : activePlanIds.includes(plan.id) ? (
                    "Plano Atual"
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" /> Assinar Agora
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Fleet - GB Packages */}
      {globalFleet.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            Frota Global (Compre Tráfego da Rede)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {globalFleet.map((plan) => (
              <div key={plan.id} className="glass rounded-2xl p-6 border border-border hover:border-emerald-500/30 transition-all">
                <div className="flex items-center gap-2 mb-3">
                  {PLAN_ICONS[plan.slug]}
                  <h4 className="text-lg font-bold text-foreground">{plan.name}</h4>
                </div>

                <div className="text-3xl font-black text-foreground mb-1">
                  {formatCurrency(plan.priceInCents)}
                </div>

                <div className="space-y-2 mt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tráfego</span>
                    <span className="font-bold text-emerald-400">{plan.gbIncluded} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preço/GB</span>
                    <span className="font-bold text-foreground">{formatCurrency(plan.gbPriceCents)}</span>
                  </div>
                </div>

                <Button
                  onClick={() => handlePurchase(plan)}
                  disabled={purchasing === plan.id}
                  className="w-full mt-6 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2"
                >
                  {purchasing === plan.id ? "Redirecionando..." : (
                    <><CreditCard className="w-4 h-4" /> Comprar Pacote</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pay-as-you-go */}
      {payPerUse.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-purple-400" />
            Pagamento por Uso (Clientes Premium)
          </h3>
          {payPerUse.map((plan) => (
            <div key={plan.id} className="glass rounded-2xl p-6 border border-purple-500/20 bg-purple-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {PLAN_ICONS[plan.slug]} {plan.name}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cobrança automática no final do mês pelo uso real. Sem pacote mínimo.
                  </p>
                  <p className="text-xs text-purple-400 mt-2">
                    Disponível para contas com 6+ meses e média de 20+ GB/mês.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-foreground">{formatCurrency(plan.gbPriceCents)}</div>
                  <span className="text-xs text-muted-foreground">por GB consumido</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Histórico de Pagamentos</h3>
          <div className="glass rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Valor</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const badge = STATUS_BADGES[p.status] || STATUS_BADGES.PENDING;
                  return (
                    <tr key={p.id} className="border-b border-border/30 last:border-none">
                      <td className="p-4 font-mono text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-4 text-foreground font-medium capitalize">
                        {p.type === "SUBSCRIPTION" ? "Assinatura" : p.type === "ONE_TIME" ? "Compra" : "Uso"}
                      </td>
                      <td className="p-4 font-bold text-foreground">{formatCurrency(p.amountCents)}</td>
                      <td className="p-4">
                        <Badge className={`${badge.color} gap-1 text-[10px]`}>
                          {badge.icon} {badge.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
