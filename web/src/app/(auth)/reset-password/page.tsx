"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const isFormValid =
    password.length >= 8 && password === confirmPassword && Boolean(token);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (!token) {
      setError("Token de redefinição ausente ou inválido.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao redefinir a senha.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="glass rounded-2xl p-6 shadow-xl text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-danger/10 text-danger mb-2">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Link Inválido</h3>
        <p className="text-sm text-muted-foreground">
          O link de redefinição de senha está incompleto ou expirou.
        </p>
        <div className="pt-4">
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover font-semibold transition-colors"
          >
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 shadow-xl">
      {submitted ? (
        <div className="text-center py-4 space-y-4 animate-fade-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Senha Alterada!</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sua senha foi redefinida com sucesso. Você já pode acessar sua conta com a nova senha.
          </p>
          <div className="pt-4">
            <button
              onClick={() => router.push("/login")}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover transition-all duration-200 cursor-pointer"
            >
              Ir para o Login
            </button>
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
              htmlFor="reset-password"
              className="text-sm font-medium text-foreground"
            >
              Nova Senha
            </label>
            <div className="relative">
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                className="w-full h-11 px-4 pr-12 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirm-password"
              className="text-sm font-medium text-foreground"
            >
              Confirmar Nova Senha
            </label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite a mesma senha novamente"
              required
              minLength={8}
              className="w-full h-11 px-4 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!isFormValid || loading}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
          >
            {loading ? (
              <div className="w-full flex items-center justify-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                <span>Atualizando...</span>
              </div>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                Redefinir Senha
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="animate-fade-in max-w-md w-full mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
          <span className="text-2xl font-bold text-primary">H</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Redefinir Senha</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Escolha uma nova senha forte para a sua conta
        </p>
      </div>

      <Suspense fallback={
        <div className="glass rounded-2xl p-6 text-center text-muted-foreground">
          Carregando...
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
