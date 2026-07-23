"use client";

import { useState, useEffect } from "react";
import { Coins, Activity, Save, CheckCircle2, Wallet, ArrowLeftRight, Percent, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminCryptoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [crypto, setCrypto] = useState({
    pointsToHiveRate: 100,
    stakingRewardRate: 5.5,
    network: "Polygon Mainnet",
    tokenAddress: "0x7a77...hivenode",
    minWithdrawalPoints: 500,
    contractStatus: "ACTIVE",
  });

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.settings?.crypto) {
          setCrypto(data.data.settings.crypto);
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
        body: JSON.stringify({ crypto }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Parâmetros de Crypto & Tokenomics atualizados!");
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
          <Coins className="text-amber-500 w-8 h-8" />
          Configurações Crypto & Tokenomics
        </h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">
          Gerenciamento do ecossistema Web3, taxa de conversão $HIVE Points, regras de staking e smart contracts.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Contract Status Card */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg text-amber-500 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Smart Contract $HIVE Token
            </CardTitle>
            <CardDescription className="text-amber-500/70">Rede ativa e status do contrato inteligente.</CardDescription>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-3 py-1 font-bold">
            {crypto.contractStatus}
          </Badge>
        </CardHeader>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Taxa de Conversão */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-amber-500" />
                Taxa de Conversão (PTS &rarr; $HIVE)
              </CardTitle>
              <CardDescription>Quantidade de HivePoints necessária para emitir 1 token $HIVE.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">HivePoints por 1 $HIVE</label>
              <Input
                type="number"
                step="1"
                value={crypto.pointsToHiveRate}
                onChange={(e) => setCrypto({ ...crypto, pointsToHiveRate: parseInt(e.target.value) || 0 })}
                className="bg-muted border-border text-lg font-bold font-mono text-amber-400"
              />
            </CardContent>
          </Card>

          {/* APY de Staking */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="w-5 h-5 text-emerald-400" />
                Rendimento de Staking (APY %)
              </CardTitle>
              <CardDescription>Taxa anual de recompensa para detentores que bloqueiam $HIVE.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Taxa Anual (%)</label>
              <Input
                type="number"
                step="0.1"
                value={crypto.stakingRewardRate}
                onChange={(e) => setCrypto({ ...crypto, stakingRewardRate: parseFloat(e.target.value) || 0 })}
                className="bg-muted border-border text-lg font-bold font-mono text-emerald-400"
              />
            </CardContent>
          </Card>

          {/* Saque Mínimo */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Saque Mínimo (PTS)
              </CardTitle>
              <CardDescription>Pontuação mínima exigida para solicitar saque Web3.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Mínimo em Pontos</label>
              <Input
                type="number"
                step="10"
                value={crypto.minWithdrawalPoints}
                onChange={(e) => setCrypto({ ...crypto, minWithdrawalPoints: parseInt(e.target.value) || 0 })}
                className="bg-muted border-border text-lg font-bold font-mono"
              />
            </CardContent>
          </Card>

          {/* Rede EVM / Solana */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="w-5 h-5 text-indigo-400" />
                Rede Blockchain Ativa
              </CardTitle>
              <CardDescription>Rede oficial de liquidação de recompensas Web3.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Nome da Rede</label>
              <Input
                type="text"
                value={crypto.network}
                onChange={(e) => setCrypto({ ...crypto, network: e.target.value })}
                className="bg-muted border-border text-sm font-semibold"
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="h-12 px-8 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-base flex items-center gap-2">
            <Save className="w-5 h-5" />
            {saving ? "Salvando..." : "Salvar Parâmetros Crypto"}
          </Button>
        </div>
      </form>
    </div>
  );
}
