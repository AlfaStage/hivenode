"use client";

import { useState } from "react";

export default function MinerPage() {
  const [wallet, setWallet] = useState<string | null>(null);

  const connectWallet = async () => {
    // Simulação de conexão Web3 / MetaMask
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
        setWallet(accounts[0]);
      } catch (err) {
        console.error("Erro ao conectar Web3", err);
      }
    } else {
      alert("Por favor, instale a MetaMask ou outra carteira Web3.");
    }
  };

  return (
    <div className="min-h-screen p-8 bg-[#0a0a0a] text-white">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold text-yellow-500">HiveMiner Web3</h1>
        {wallet ? (
          <span className="bg-gray-800 px-4 py-2 rounded font-mono text-sm border border-gray-700">
            {wallet.substring(0, 6)}...{wallet.substring(wallet.length - 4)}
          </span>
        ) : (
          <button 
            onClick={connectWallet}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-2 rounded-full transition-all"
          >
            🔗 Conectar MetaMask
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <h2 className="text-xl text-gray-400 mb-2">Pontos Acumulados ($HIVE Points)</h2>
          <p className="text-5xl font-black text-yellow-500 mb-6">14,500.00</p>
          <button className="bg-white text-black font-bold w-full py-3 rounded-lg hover:bg-gray-200">
            Sacar para Carteira (Claim)
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <h2 className="text-xl font-semibold mb-4 text-gray-300">Indique e Ganhe</h2>
          <p className="text-sm text-gray-400 mb-4">Ganhe 10% de todos os pontos minerados pelos seus indicados.</p>
          <div className="bg-black p-3 rounded border border-gray-700 flex justify-between items-center">
            <span className="font-mono text-sm text-yellow-500">REF-HIVE-992X</span>
            <button className="text-xs text-gray-400 hover:text-white uppercase font-bold tracking-wider">Copiar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
