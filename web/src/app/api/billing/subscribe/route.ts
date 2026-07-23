// ==============================================================================
// API Route: Billing - Subscribe (Assinatura recorrente)
// ==============================================================================

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { createSubscription, createCustomer } from "@/lib/abacatepay";

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAuth();
    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!user) return apiError("Usuário não encontrado", 404);

    const body = await request.json();
    const { planId, couponCode } = body;

    if (!planId) return apiError("Plano é obrigatório", 400);

    // Buscar plano
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return apiError("Plano não encontrado", 404);
    if (!plan.isRecurring) return apiError("Use /api/billing/checkout para compras únicas", 400);
    if (!plan.abacateProductId) return apiError("Plano não configurado no gateway de pagamento", 400);
    if (plan.isAdminOnly) return apiError("Este plano não está disponível para compra", 403);

    // Verificar se já tem assinatura ativa PARA ESTE MESMO TIPO de plano
    // Um usuário pode ter Frota Privada + Pacotes GB + Miner ao mesmo tempo
    const existingSub = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
        planId: { not: null },
      },
      include: { user: false },
    });

    if (existingSub) {
      // Buscar plano da assinatura existente
      const existingPlan = existingSub.planId
        ? await prisma.plan.findUnique({ where: { id: existingSub.planId } })
        : null;

      // Bloquear somente se for da MESMA categoria (ex: já tem Starter, quer Pro → bloqueia)
      if (existingPlan && existingPlan.category === plan.category) {
        return apiError(
          `Você já possui uma assinatura ativa na categoria "${existingPlan.category === "PRIVATE_FLEET" ? "Frota Privada" : existingPlan.category}". Cancele a atual antes de trocar.`,
          409
        );
      }
    }

    // Garantir que o cliente existe no AbacatePay
    let customerId = user.abacatePayCustId;
    if (!customerId) {
      try {
        const customerRes = await createCustomer(user.email);
        customerId = customerRes.data?.id;
        if (customerId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { abacatePayCustId: customerId },
          });
        }
      } catch (e) {
        console.error("[Billing] Erro ao criar cliente:", e);
      }
    }

    const host = request.headers.get("host") || "hivenode.alfastage.com.br";
    const returnUrl = `https://${host}/dashboard/billing`;

    // Criar assinatura no AbacatePay
    const subRes = await createSubscription({
      productId: plan.abacateProductId,
      customerId: customerId || undefined,
      returnUrl,
      metadata: {
        system: "hivenode",
        userId: user.id,
        planId: plan.id,
        planSlug: plan.slug,
      },
      coupons: couponCode ? [couponCode] : undefined,
    });

    // Criar subscription local (status PENDING até webhook confirmar)
    const nextPeriod = new Date();
    nextPeriod.setMonth(nextPeriod.getMonth() + 1);

    // Mapear slug para PlanType
    const planTypeMap: Record<string, string> = {
      starter: "STARTER",
      pro: "PRO",
      enterprise: "ENTERPRISE",
      founder: "FOUNDER",
    };

    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        planType: (planTypeMap[plan.slug] || "STARTER") as any,
        status: "PENDING",
        abacatePaySubId: subRes.data?.id,
        currentPeriodEnd: nextPeriod,
      },
    });

    return apiSuccess({
      checkoutUrl: subRes.data?.url,
      subscriptionId: subRes.data?.id,
    });
  } catch (error: unknown) {
    console.error("[Billing/Subscribe] Erro:", error);
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao criar assinatura", 500);
  }
}
