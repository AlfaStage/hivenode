import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { sendProxyAlert } from "@/lib/email";
import { redis } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const payload = await requireAuth();

    const body = await request.json();
    const { proxyUser, proxyPass, nodeId } = body;

    if (!proxyUser || !proxyPass || !nodeId) {
      return apiError("Preencha todos os campos do Proxy", 400);
    }

    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node || node.userId !== payload.userId) {
      return apiError("Aparelho Físico não encontrado ou não pertence a você", 404);
    }

    // 1. Calcular limite total de proxies com base em todos os planos ativos
    const userSubs = await prisma.subscription.findMany({
      where: { userId: payload.userId, status: "ACTIVE" },
      include: { plan: true },
    });

    let totalAllowed = 0;
    let hasUnlimited = false;

    if (userSubs.length === 0) {
      return apiError("Você precisa assinar um plano para criar proxies", 403);
    }

    for (const sub of userSubs) {
      if (sub.plan) {
        if (sub.plan.maxProxies === 0) hasUnlimited = true;
        totalAllowed += sub.plan.maxProxies;
      }
    }

    if (!hasUnlimited) {
      const currentProxiesCount = await prisma.proxyCredential.count({
        where: { userId: payload.userId }
      });
      if (currentProxiesCount >= totalAllowed) {
        return apiError(`Limite de proxies excedido (Máximo: ${totalAllowed}). Faça um upgrade para adicionar mais.`, 403);
      }
    }

    const bcryptjs = require("bcryptjs");
    const maskedPass = await bcryptjs.hash(proxyPass, 4);

    const proxy = await prisma.proxyCredential.create({
      data: {
        userId: payload.userId,
        nodeId,
        proxyUser,
        proxyPass: maskedPass,
      }
    });

    try {
      await redis.set(`proxy:${proxyUser}`, `${nodeId}:${maskedPass}`);
    } catch (redisError) {
      console.log("Aviso: Falha ao injetar no Redis imediatamente, o Broker fará fallback.", redisError);
    }

    const safeProxy = {
      ...proxy,
      totalBytesRx: Number(proxy.totalBytesRx),
      totalBytesTx: Number(proxy.totalBytesTx)
    };

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
    if (user?.email) {
      sendProxyAlert(user.email, proxyUser).catch(console.error);
    }

    return apiSuccess({ proxy: safeProxy });
  } catch (error: any) {
    console.error("Erro em POST /api/proxies:", error);
    if (error.code === 'P2002') {
      return apiError("Este nome de usuário proxy já está em uso.", 400);
    }
    return apiError("Erro ao criar proxy SOCKS5", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth(); // O Dashboard sempre tem cookies

    const proxies = await prisma.proxyCredential.findMany({
      where: { userId: payload.userId },
      include: { node: true },
      orderBy: { createdAt: 'desc' }
    });

    // Converte BigInt para Number para evitar erro de serialização do JSON
    const safeProxies = proxies.map(p => ({
      ...p,
      totalBytesRx: Number(p.totalBytesRx),
      totalBytesTx: Number(p.totalBytesTx)
    }));

    return apiSuccess({ proxies: safeProxies });
  } catch (error) {
    console.error("Erro em GET /api/proxies:", error);
    return apiError("Token inválido", 401);
  }
}
