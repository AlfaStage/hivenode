"use client";

import { useState } from "react";
import { Shield, Smartphone, TerminalSquare } from "lucide-react";

export default function DeviceApprovePage() {
  const [userCode, setUserCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userCode.length < 5) return;
    
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/device-code/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: userCode.trim().toUpperCase() })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Código inválido ou expirado.");
      
      setMessage({
        type: "success",
        text: "Aparelho aprovado com sucesso! Peça ao aparelho (ou HiveDocker) para prosseguir."
      });
      setUserCode("");
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center bg-[#111114] p-6 border border-[#27272e] rounded-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Shield className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Aprovar Aparelho</h1>
            <p className="text-[#8e8e99] mt-1">
              Digite o código de 6 caracteres fornecido pelo novo dispositivo para vinculá-lo.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#111114] p-8 border border-[#27272e] rounded-xl">
        <form onSubmit={handleApprove} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-[#8e8e99] mb-2 uppercase tracking-wider">
              Código de Verificação
            </label>
            <input 
              type="text" 
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              placeholder="Ex: HIVE-X"
              maxLength={8}
              className="w-full bg-[#0a0a0c] border border-[#27272e] rounded-xl px-5 py-4 text-white text-2xl font-mono text-center focus:border-amber-500 focus:outline-none uppercase tracking-widest"
              autoFocus
            />
          </div>
          
          {message && (
            <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              {message.text}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || userCode.length < 5}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
          >
            {loading ? "Aprovando..." : "Aprovar Vínculo"}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-[#27272e] grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#27272e]">
            <TerminalSquare className="w-5 h-5 text-amber-500 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">HiveDocker</h3>
            <p className="text-xs text-[#8e8e99]">Se você iniciou o processo via CLI, o código apareceu no terminal do seu servidor.</p>
          </div>
          <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#27272e]">
            <Smartphone className="w-5 h-5 text-blue-500 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Apps Android</h3>
            <p className="text-xs text-[#8e8e99]">Se está configurando uma TV Box sem câmera, use o modo Código Curto no app.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
