import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import { sendNodeAlert } from "@/lib/email";

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
      liveNodes = await redis.smembers("hivenode:online_nodes");
    } catch (e) {
      console.log("Aviso: Falha ao puxar live nodes do Redis");
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
    const payload = await requireAuth();

    const body = await request.json();
    const { deviceName, visibility } = body;

    if (!deviceName) return apiError("Nome do dispositivo é obrigatório", 400);

    const safeVisibility = visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";

    // 1. Calcular limite total de aparelhos com base em todos os planos ativos
    const userSubs = await prisma.subscription.findMany({
      where: { userId: payload.userId, status: "ACTIVE" },
      include: { plan: true },
    });

    let totalAllowed = 0;
    let hasUnlimited = false;

    if (userSubs.length === 0) {
      return apiError("Você precisa assinar um plano para adicionar aparelhos", 403);
    }

    // Buscar todos os planos relacionados às assinaturas de forma eficiente
    for (const sub of userSubs) {
      if (sub.plan) {
        if (sub.plan.maxDevices === 0) hasUnlimited = true;
        totalAllowed += sub.plan.maxDevices;
      }
    }

    if (!hasUnlimited) {
      const currentNodesCount = await prisma.node.count({
        where: { userId: payload.userId }
      });
      if (currentNodesCount >= totalAllowed) {
        return apiError(`Limite de aparelhos excedido (Máximo: ${totalAllowed}). Faça um upgrade para adicionar mais.`, 403);
      }
    }

    const node = await prisma.node.create({
      data: {
        userId: payload.userId,
        deviceModel: deviceName,
        status: "OFFLINE",
        type: "BYOD",
        visibility: safeVisibility,
      }
    });

    // Registra imediatamente no Redis para o Broker Go
    await redis.set(`node_visibility:${node.id}`, safeVisibility);

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
    if (user?.email) {
      sendNodeAlert(user.email, deviceName, safeVisibility).catch(console.error);
    }

    console.log(`[API Nodes] Novo node criado: ${node.id} por ${payload.userId} (${safeVisibility})`);
    return apiSuccess({ node });
  } catch (error) {
    console.error("[API Nodes] Erro ao criar node:", error);
    return apiError("Erro ao criar node", 500);
  }
}
