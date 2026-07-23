"use client";

import { useState, useEffect } from "react";
import { Settings, Activity, Save, CheckCircle2, Mail, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [general, setGeneral] = useState({
    maintenanceMode: false,
    smtpHost: "smtp-relay.brevo.com",
    smtpSender: "hivenode@alfastage.com.br",
    smtpStatus: "CONNECTED",
    lgpdAuditEnabled: true,
  });

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.settings?.general) {
          setGeneral(data.data.settings.general);
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
        body: JSON.stringify({ general }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Configurações gerais atualizadas com sucesso!");
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
          <Settings className="text-foreground w-8 h-8" />
          Configurações Gerais do Sistema
        </h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">
          Gerenciamento do servidor SMTP de e-mails, alertas do sistema, conformidade LGPD e modo de manutenção.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* SMTP Status */}
        <Card className="border-border bg-card/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" /> Serviço de E-mail (SMTP Brevo)
              </CardTitle>
              <CardDescription>Servidor ativo para envio de boas-vindas e alertas de sistema.</CardDescription>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold">
              {general.smtpStatus}
            </Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Servidor Host</label>
              <Input
                type="text"
                value={general.smtpHost}
                onChange={(e) => setGeneral({ ...general, smtpHost: e.target.value })}
                className="bg-muted border-border text-sm font-mono mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">E-mail Remetente Oficial</label>
              <Input
                type="text"
                value={general.smtpSender}
                onChange={(e) => setGeneral({ ...general, smtpSender: e.target.value })}
                className="bg-muted border-border text-sm font-mono mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Security & Maintenance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Modo Manutenção
              </CardTitle>
              <CardDescription>Bloqueia temporariamente o acesso de clientes ao painel.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Status da Manutenção</span>
              <button
                type="button"
                onClick={() => setGeneral({ ...general, maintenanceMode: !general.maintenanceMode })}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  general.maintenanceMode
                    ? "bg-amber-500 text-black shadow-md"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {general.maintenanceMode ? "ATIVADO" : "DESATIVADO"}
              </button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Conformidade LGPD
              </CardTitle>
              <CardDescription>Auditoria ativa de aceite de cookies e privacidade.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Registro de Auditoria</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                {general.lgpdAuditEnabled ? "HABILITADO" : "DESABILITADO"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="h-12 px-8 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-base flex items-center gap-2">
            <Save className="w-5 h-5" />
            {saving ? "Salvando..." : "Salvar Configurações Gerais"}
          </Button>
        </div>
      </form>
    </div>
  );
}
