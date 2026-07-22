"use client";

import { useState } from "react";

export default function SaaSPage() {
  const [email, setEmail] = useState("");

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    // Chamada simulada para API de compartilhamento B2B
    console.log("Compartilhando nós com:", email);
    alert(`Convite enviado para ${email}`);
  };

  return (
    <div className="min-h-screen p-8 text-black bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Painel Corporativo (SaaS)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Seus Dispositivos (Nós Privados)</h2>
          <ul className="space-y-2">
            <li className="flex justify-between p-3 bg-gray-100 rounded">
              <span>📱 Galaxy S23 (SP)</span>
              <span className="text-green-600 font-bold">ONLINE</span>
            </li>
            <li className="flex justify-between p-3 bg-gray-100 rounded">
              <span>📱 iPhone 14 (RJ)</span>
              <span className="text-red-600 font-bold">OFFLINE</span>
            </li>
          </ul>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Compartilhar Acesso (B2B)</h2>
          <form onSubmit={handleShare} className="flex gap-4">
            <input 
              type="email" 
              placeholder="Email do Gestor" 
              className="border p-2 rounded flex-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
              Convidar
            </button>
          </form>
          <p className="text-sm text-gray-500 mt-4">
            O convidado terá acesso para utilizar a banda proxy, mas não poderá deletar o dispositivo.
          </p>
        </section>
      </div>
      
      {/* TODO: Integrar Recharts aqui para exibir Consumo de Banda */}
      <section className="mt-8 bg-white p-6 rounded-lg shadow h-64 flex items-center justify-center">
        <span className="text-gray-400">[Gráfico de Consumo de Banda - Recharts Placeholder]</span>
      </section>
    </div>
  );
}
