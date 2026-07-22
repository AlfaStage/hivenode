import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await requireAuth();
    const resolvedParams = await params;

    const proxy = await prisma.proxyCredential.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!proxy || proxy.userId !== payload.userId) {
      return apiError("Proxy não encontrado", 404);
    }

    // 1. Apaga do Banco de Dados
    await prisma.proxyCredential.delete({
      where: { id: proxy.id },
    });

    // 2. Apaga da Memória RAM (Redis) para revogar acesso instantaneamente
    try {
      await redis.del(`proxy:${proxy.proxyUser}`);
    } catch (e) {
      console.log("Falha ao apagar do Redis, acesso pode demorar alguns minutos para cair.");
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Erro ao deletar proxy:", error);
    return apiError("Erro ao remover proxy", 500);
  }
}
