// ==============================================================================
// API Route: GET /api/auth/me
// ==============================================================================

import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { getSystemSettings } from "@/lib/settings";

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
        hivePoints: true,
        activePlanId: true,
        createdAt: true,
        _count: {
          select: {
            nodes: true,
            subscriptions: true,
            proxies: true,
          },
        },
        subscriptions: {
          where: { status: { in: ["ACTIVE", "PENDING"] } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            planId: true,
            planType: true,
            status: true,
            currentPeriodEnd: true,
            createdAt: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            planId: true,
            type: true,
            amountCents: true,
            status: true,
            createdAt: true,
            metadata: true,
          },
        },
      },
    });

    if (!user) {
      return apiError("Usuário não encontrado", 404);
    }

    const settings = await getSystemSettings();
    return apiSuccess({ ...user, pointsToGbRate: settings.crypto.pointsToHiveRate });
  } catch (error) {
    console.error("[API] Me error:", error);
    return apiError("Erro interno do servidor", 500);
  }
}
