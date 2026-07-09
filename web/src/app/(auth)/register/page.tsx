"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, UserPlus, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const isFormValid =
    email.length > 0 &&
    password.length >= 8 &&
    confirmPassword.length > 0 &&
    passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!passwordsMatch) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao criar conta");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Logo / Branding */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
          <span className="text-2xl font-bold text-primary">H</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Criar conta</h1>
        <p className="text-muted-foreground mt-1">
          Junte-se à rede HiveNode
        </p>
      </div>

      {/* Card do formulário */}
      <div className="glass rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm animate-fade-in">
              <span className="shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-2">
            <label
              htmlFor="register-email"
              className="text-sm font-medium text-foreground"
            >
              E-mail
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
              className="w-full h-11 px-4 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 outline-none"
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label
              htmlFor="register-password"
              className="text-sm font-medium text-foreground"
            >
              Senha
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full h-11 px-4 pr-12 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-2">
            <label
              htmlFor="register-confirm-password"
              className="text-sm font-medium text-foreground"
            >
              Confirmar senha
            </label>
            <input
              id="register-confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              autoComplete="new-password"
              required
              className={`w-full h-11 px-4 rounded-xl bg-muted border text-foreground placeholder:text-muted-foreground focus:ring-2 transition-all duration-200 outline-none ${
                confirmPassword.length > 0 && !passwordsMatch
                  ? "border-danger focus:border-danger focus:ring-danger/20"
                  : "border-border focus:border-primary focus:ring-primary/20"
              }`}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-danger animate-fade-in">
                As senhas não coincidem
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            id="register-submit"
            type="submit"
            disabled={!isFormValid || loading}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Criar conta
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Login Link */}
        <p className="text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="text-primary hover:text-primary-hover font-medium transition-colors"
          >
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
