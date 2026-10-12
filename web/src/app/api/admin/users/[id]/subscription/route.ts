// ==============================================================================
// API Route: POST /api/admin/users/[id]/subscription
// ==============================================================================

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { PlanType, PlanCategory, SubStatus } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: userId } = await params;
    const body = await request.json();

    const { planId, currentPeriodEnd, isFree, customPriceCents } = body;

    if (!planId) return apiError("O ID do plano é obrigatório", 400);
    if (!currentPeriodEnd) return apiError("A data de expiração é obrigatória", 400);

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return apiError("Plano não encontrado", 404);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return apiError("Usuário não encontrado", 404);

    const endDate = new Date(currentPeriodEnd);
    if (isNaN(endDate.getTime())) return apiError("Data de expiração inválida", 400);

    // Cancelar qualquer assinatura ativa atual do usuário (para não acumular)
    await prisma.subscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "CANCELED", updatedAt: new Date() },
    });

    // Criar a nova assinatura
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        planType: "FREE", // Usaremos FREE como dummy já que o plano real tem o ID
        planCategory: plan.category,
        status: "ACTIVE",
        currentPeriodEnd: endDate,
      },
    });

    // Atualizar o usuário para apontar para o novo activePlanId
    await prisma.user.update({
      where: { id: userId },
      data: { activePlanId: plan.id },
    });

    // Se a conta estava com status BLOCKED, e a nova assinatura é válida, desativar o bloqueio:
    // (Na verdade, os Nodes ficam BLOCKED e o cron verifica)
    if (endDate > new Date()) {
      await prisma.node.updateMany({
        where: { userId, status: "BLOCKED" },
        data: { status: "OFFLINE" },
      });
      
      // Criar pagamento correspondente
      if (!isFree) {
        await prisma.payment.create({
          data: {
            userId,
            planId: plan.id,
            type: "SUBSCRIPTION",
            amountCents: customPriceCents !== undefined ? customPriceCents : plan.priceInCents,
            status: "PAID",
            metadata: { source: "admin_manual_grant" }
          }
        });
      }
    }

    return apiSuccess({
      message: "Assinatura concedida com sucesso",
      subscription,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    console.error("[Admin Subscription Grant Error]", error);
    return apiError("Erro ao conceder assinatura", 500);
  }
}
