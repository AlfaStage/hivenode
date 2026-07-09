import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, requireAuth } from "@/lib/auth";
import { apiError, apiSuccess, generateSecureString } from "@/lib/utils";

async function resolvePayload(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    return await verifyToken(authHeader.split(" ")[1]);
  }
  return await requireAuth();
}

// Buscar Nodes do usuário
export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth();

    const nodes = await prisma.node.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: "desc" },
    });

    let liveNodes: string[] = [];
    try {
      // Pergunta pra Memória RAM do Broker (sem depender de redis/postgres) na Porta 10001
      const res = await fetch("http://broker:10001/live-nodes", { cache: 'no-store' });
      if (res.ok) liveNodes = await res.json();
    } catch (e) {
      console.log("Aviso: Falha ao puxar live nodes do broker");
    }

    const mappedNodes = nodes.map(n => ({
      ...n,
      deviceName: n.deviceModel || "Aparelho Desconhecido",
      status: liveNodes.includes(n.id) ? "ONLINE" : "OFFLINE"
    }));

    return apiSuccess({ nodes: mappedNodes });
  } catch (error) {
    console.error("[API Nodes] Erro ao buscar nodes:", error);
    return apiError("Erro ao buscar nodes", 500);
  }
}

// Criar novo Node
export async function POST(request: NextRequest) {
  try {
    const payload = await resolvePayload(request);

    const body = await request.json();
    const { deviceName } = body;

    if (!deviceName) return apiError("Nome do dispositivo é obrigatório", 400);

    const node = await prisma.node.create({
      data: {
        userId: payload.userId,
        deviceModel: deviceName,
        status: "OFFLINE",
        type: "BYOD",
      }
    });

    console.log(`[API Nodes] Novo node criado: ${node.id} por ${payload.userId}`);
    return apiSuccess({ node });
  } catch (error) {
    console.error("[API Nodes] Erro ao criar node:", error);
    return apiError("Erro ao criar node", 500);
  }
}
