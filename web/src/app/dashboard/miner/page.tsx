"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Pickaxe, Server, Activity, Plus, Smartphone, Terminal, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import QRCode from "react-qr-code";

export default function MinerDashboard() {
  const [points, setPoints] = useState(14500.00);
  const [copied, setCopied] = useState(false);
  const [miners, setMiners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // Simular ganho de pontos ao vivo
    const interval = setInterval(() => {
      setPoints(prev => prev + (Math.random() * 0.1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Buscar nodes (miners) reais do usuário
    const fetchNodes = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/nodes", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          // Filtrar apenas nodes do tipo PUBLIC (que são os miners que ganham pontos)
          const publicNodes = data.data.nodes.filter((n: any) => n.visibility === "PUBLIC");
          setMiners(publicNodes);
          setUserData(data.data.user);
          // Set real points if available from backend, assuming hivePoints exists
          if (data.data.user && data.data.user.hivePoints !== undefined) {
             setPoints(Number(data.data.user.hivePoints));
          }
        }
      } catch (err) {
        console.error("Erro ao buscar miners:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNodes();
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText("REF-HIVE-992X");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
          <Pickaxe className="text-emerald-500 w-8 h-8" />
          HiveMiner
        </h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">
          Transforme seus dispositivos ociosos em pontuação e recompensas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Painel Principal de Pontos */}
        <Card className="md:col-span-2 border-emerald-500/20 bg-[#0c120e] relative overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.05)]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-emerald-400"></div>
          <CardHeader>
            <CardTitle className="text-emerald-500 flex items-center gap-2">
              <Activity className="w-5 h-5 animate-pulse" /> Pontos Acumulados
            </CardTitle>
            <CardDescription className="text-emerald-500/60">Saldo em tempo real ($HIVE Points)</CardDescription>
          </CardHeader>
          <CardContent>
            <motion.p 
              key={Math.floor(points)} // re-anima a cada número inteiro
              initial={{ scale: 1.02 }}
              animate={{ scale: 1 }}
              className="text-6xl font-black text-white tracking-tighter"
            >
              {points.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.p>
          </CardContent>
          <CardFooter>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 text-lg">
              Resgatar Recompensas (Em breve)
            </Button>
          </CardFooter>
        </Card>

        {/* Indique e Ganhe */}
        <Card className="border-border bg-card/40">
          <CardHeader>
            <CardTitle className="text-lg">Indique e Ganhe</CardTitle>
            <CardDescription>Ganhe 10% de todos os pontos minerados pelos seus indicados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-black/50 p-4 rounded-xl border border-border flex justify-between items-center">
              <span className="font-mono text-sm text-emerald-400 font-bold">REF-HIVE-992X</span>
              <Button variant="ghost" size="sm" onClick={handleCopyCode} className="text-muted-foreground hover:text-white">
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Miners */}
      <div className="flex justify-between items-center mt-10 mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Server className="text-emerald-500" /> Seus Aparelhos (Miners)
        </h2>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-bold border-none">
              <Plus className="w-4 h-4" /> Conectar Aparelho
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md border-emerald-500/30 bg-[#0a0a0c]">
            <DialogHeader>
              <DialogTitle className="text-emerald-500 text-xl font-bold flex items-center gap-2">
                <Smartphone className="w-5 h-5" /> Vincular Novo HiveMiner
              </DialogTitle>
              <DialogDescription>
                Baixe o aplicativo HiveMiner no seu celular ou instale via CLI no seu PC para começar a pontuar.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-6 py-4">
              <div className="bg-white p-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                {userData?.id ? (
                  <QRCode value={`hiveminer://link?token=${userData.id}`} size={180} />
                ) : (
                  <div className="w-[180px] h-[180px] bg-gray-200 flex items-center justify-center text-gray-500 text-sm text-center">Carregando Token...</div>
                )}
              </div>
              <p className="text-sm text-center text-muted-foreground font-medium">
                Abra o app HiveMiner e escaneie o código acima, ou cole o token manual abaixo.
              </p>
              <div className="w-full bg-black border border-border p-3 rounded-lg flex items-center gap-3">
                <Terminal className="w-4 h-4 text-emerald-500 shrink-0" />
                <code className="text-xs text-emerald-400 truncate flex-1">{userData?.id || "Aguarde..."}</code>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:bg-emerald-500/20" onClick={() => {
                  if(userData?.id) navigator.clipboard.writeText(userData.id);
                }}>
                  <Copy className="w-4 h-4 text-emerald-500" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="w-full border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10">Pronto</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border bg-card/40 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Modelo / Nome</TableHead>
              <TableHead>ID do Dispositivo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Métricas (1h)</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground animate-pulse">
                  Carregando seus aparelhos...
                </TableCell>
              </TableRow>
            ) : miners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Smartphone className="w-12 h-12 text-muted-foreground/30" />
                    <p>Você não tem nenhum aparelho conectado ao HiveMiner.</p>
                    <p className="text-sm">Clique em "Conectar Aparelho" para vincular seu celular ou PC.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              miners.map((miner) => (
                <TableRow key={miner.id} className="border-border">
                  <TableCell className="font-medium text-white">{miner.deviceModel || "Dispositivo Genérico"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{miner.id}</TableCell>
                  <TableCell>
                    {miner.status === "ONLINE" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">ONLINE</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">OFFLINE</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="text-emerald-500 font-medium">Uptime: 99.9%</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-950/30">Desconectar</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
