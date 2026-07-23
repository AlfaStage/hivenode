// ==============================================================================
// API Route: Billing - Checkout (Compra única de pacotes GB)
// ==============================================================================

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { createCheckout, createCustomer } from "@/lib/abacatepay";

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
    if (plan.isRecurring) return apiError("Use /api/billing/subscribe para planos recorrentes", 400);
    if (!plan.abacateProductId) return apiError("Plano não configurado no gateway de pagamento", 400);

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

    // Criar checkout no AbacatePay
    const checkoutRes = await createCheckout({
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

    // Registrar pagamento pendente
    await prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        type: "ONE_TIME",
        amountCents: plan.priceInCents,
        status: "PENDING",
        abacateCheckoutId: checkoutRes.data?.id,
      },
    });

    return apiSuccess({
      checkoutUrl: checkoutRes.data?.url,
      checkoutId: checkoutRes.data?.id,
    });
  } catch (error: unknown) {
    console.error("[Billing/Checkout] Erro:", error);
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao criar checkout", 500);
  }
}
