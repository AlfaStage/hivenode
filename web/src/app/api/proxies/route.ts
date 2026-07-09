import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/utils";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

async function resolvePayload(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.trim() !== "") {
    try {
      return await verifyToken(authHeader.split(" ")[1]);
    } catch {
      // Ignora erro do header e tenta o cookie
    }
  }
  return await requireAuth();
}

export async function POST(request: NextRequest) {
  try {
    const payload = await resolvePayload(request);

    const body = await request.json();
    const { proxyUser, proxyPass, nodeId } = body;

    if (!proxyUser || !proxyPass || !nodeId) {
      return apiError("Preencha todos os campos do Proxy", 400);
    }

    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node || node.userId !== payload.userId) {
      return apiError("Aparelho Físico não encontrado ou não pertence a você", 404);
    }

    const proxy = await prisma.proxyCredential.create({
      data: {
        userId: payload.userId,
        nodeId,
        proxyUser,
        proxyPass,
      }
    });

    try {
      await redis.set(`proxy:${proxyUser}`, `${nodeId}:${proxyPass}`);
    } catch (redisError) {
      console.log("Aviso: Falha ao injetar no Redis imediatamente, o Broker fará fallback.", redisError);
    }

    const safeProxy = {
      ...proxy,
      totalBytesRx: Number(proxy.totalBytesRx),
      totalBytesTx: Number(proxy.totalBytesTx)
    };

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
