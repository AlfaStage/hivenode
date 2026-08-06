"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao solicitar recuperação de senha.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in max-w-md w-full mx-auto">
      {/* Logo / Branding */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
          <span className="text-2xl font-bold text-primary">H</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Recuperar Senha
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Informe seu e-mail cadastrado para receber o link de redefinição
        </p>
      </div>

      {/* Card */}
      <div className="glass rounded-2xl p-6 shadow-xl">
        {submitted ? (
          <div className="text-center py-4 space-y-4 animate-fade-in">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">E-mail Enviado!</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Se o e-mail <span className="font-semibold text-foreground">{email}</span> estiver cadastrado em nosso sistema, você receberá um link em instantes.
            </p>
            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="forgot-email"
                className="text-sm font-medium text-foreground"
              >
                E-mail
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
                className="w-full h-11 px-4 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!email || loading}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
            >
              {loading ? (
                <div className="w-full flex items-center justify-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  <span>Enviando...</span>
                </div>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Enviar Link de Recuperação
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
