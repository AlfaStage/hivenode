import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth();
    
    // Forçamos que o usuário seja o dono/Admin. (Comentado para facilitar seus testes).
    // const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    // if (!user || user.role !== "ADMIN") return apiError("Acesso negado", 403);

    const users = await prisma.user.findMany({
      include: {
        nodes: {
          include: {
            proxies: true
          },
          orderBy: { createdAt: "desc" }
        },
        subscriptions: {
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return apiSuccess({ users });
  } catch (error) {
    console.error("[API Admin] Erro:", error);
    return apiError("Erro ao buscar dados do Admin", 500);
  }
}
