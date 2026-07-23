// ==============================================================================
// API Route: Billing - Redeem Points (Converter pontos miner → GB)
// ==============================================================================

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/settings";

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAuth();
    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!user) return apiError("Usuário não encontrado", 404);

    const body = await request.json();
    const { pointsToRedeem } = body;

    if (!pointsToRedeem || pointsToRedeem <= 0) {
      return apiError("Quantidade de pontos inválida", 400);
    }

    if (user.hivePoints < pointsToRedeem) {
      return apiError(`Saldo insuficiente. Você tem ${user.hivePoints.toFixed(2)} pontos.`, 400);
    }

    // Buscar taxa de conversão das configurações do sistema
    const settings = getSystemSettings();
    const pointsPerGb = settings.crypto.pointsToHiveRate || 100; // padrão: 100 pontos = 1 GB

    const gbToAdd = pointsToRedeem / pointsPerGb;

    if (gbToAdd < 0.01) {
      return apiError(`Mínimo de ${pointsPerGb} pontos para converter (= 1 GB).`, 400);
    }

    // Transação atômica: debitar pontos + creditar GB
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          hivePoints: { decrement: pointsToRedeem },
          balanceGB: { increment: gbToAdd },
        },
      }),
      prisma.pointsLedger.create({
        data: {
          userId: user.id,
          amount: -pointsToRedeem,
          type: "CLAIM",
        },
      }),
      prisma.payment.create({
        data: {
          userId: user.id,
          type: "PAY_PER_USE",
          amountCents: 0, // gratuito, conversão de pontos
          status: "PAID",
          metadata: {
            type: "points_redemption",
            pointsRedeemed: pointsToRedeem,
            gbAdded: gbToAdd,
            rate: pointsPerGb,
          },
        },
      }),
    ]);

    return apiSuccess({
      pointsRedeemed: pointsToRedeem,
      gbAdded: gbToAdd,
      newBalance: {
        points: user.hivePoints - pointsToRedeem,
        gb: (user.balanceGB || 0) + gbToAdd,
      },
    });
  } catch (error: unknown) {
    console.error("[Billing/Redeem] Erro:", error);
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao converter pontos", 500);
  }
}
