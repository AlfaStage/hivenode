import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 space-y-6">
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.2)]">
            <AlertTriangle className="w-12 h-12 text-primary" />
          </div>
        </div>

        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40">
          404
        </h1>
        
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">Página não encontrada</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            O recurso que você está procurando pode ter sido removido, renomeado ou está temporariamente indisponível.
          </p>
        </div>

        <div className="pt-8">
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary-hover hover:scale-105 transition-all shadow-[0_0_20px_rgba(var(--primary),0.3)]"
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}
