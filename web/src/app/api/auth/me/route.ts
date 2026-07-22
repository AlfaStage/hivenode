// ==============================================================================
// API Route: GET /api/auth/me
// ==============================================================================

import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-utils";

export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return apiError("Não autenticado", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true,
        email: true,
        role: true,
        balanceGB: true,
        createdAt: true,
        _count: {
          select: {
            nodes: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!user) {
      return apiError("Usuário não encontrado", 404);
    }

    return apiSuccess({ user });
  } catch (error) {
    console.error("[API] Me error:", error);
    return apiError("Erro interno do servidor", 500);
  }
}
