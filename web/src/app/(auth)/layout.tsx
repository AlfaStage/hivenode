import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autenticação",
  description: "Acesse ou crie sua conta HiveNode.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background gradient decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]" />
      </div>

      {/* Grid sutil no fundo */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
