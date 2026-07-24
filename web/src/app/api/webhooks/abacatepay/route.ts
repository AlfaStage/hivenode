// ==============================================================================
// API Route: Webhook AbacatePay v2 (Reescrito)
// ==============================================================================

import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-utils";

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-abacate-signature") || "";

    // Buscar secret do banco
    let secret = "";
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: "abacatepay_webhook_secret" },
      });
      secret = config?.value || process.env.ABACATE_PAY_WEBHOOK_SECRET || "";
    } catch {
      secret = process.env.ABACATE_PAY_WEBHOOK_SECRET || "";
    }

    if (!secret) {
      console.error("[Webhook] Erro: Webhook secret não configurado");
      return apiError("Webhook secret not configured", 500);
    }

    if (!signature) {
      console.warn("[Webhook] ⚠️ Assinatura ausente no request");
      return apiError("Missing signature", 401);
    }

    // Validar HMAC
    if (!verifySignature(rawBody, signature, secret)) {
      console.warn("[Webhook] ⚠️ Assinatura HMAC inválida");
      return apiError("Invalid signature", 401);
    }

    const event = JSON.parse(rawBody);

    // FILTRO: Ignorar webhooks que NÃO são do sistema HiveNode
    const metadata = event.data?.metadata || {};
    if (metadata.system && metadata.system !== "hivenode") {
      console.log(`[Webhook] Ignorado - sistema: ${metadata.system}`);
      return apiSuccess({ received: true, ignored: true });
    }

    const eventType = event.type || event.event;
    console.log(`[Webhook] Evento recebido: ${eventType}`);
    const externalId = event.id || event.data?.id || crypto.randomUUID();

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Inserir idempotente
        await tx.webhookEvent.create({
          data: { externalId: `${externalId}:${eventType}`, eventType, payload: event }
        });

        // 2. Processamento real
        switch (eventType) {
          case "checkout.completed": {
            const checkoutId = event.data?.id || event.data?.checkoutId;
            const payment = await tx.payment.findUnique({ where: { abacateCheckoutId: checkoutId } });
            if (payment) {
              await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID" } });
              if (payment.planId) {
                const plan = await tx.plan.findUnique({ where: { id: payment.planId } });
                if (plan && plan.gbIncluded > 0) {
                  await tx.user.update({
                    where: { id: payment.userId },
                    data: { balanceGB: { increment: plan.gbIncluded }, activePlanId: plan.id },
                  });
                }
              }
              await tx.node.updateMany({
                where: { userId: payment.userId, status: "BLOCKED" },
                data: { status: "OFFLINE" },
              });
            }
            break;
          }
          case "checkout.refunded": {
            const checkoutId = event.data?.id || event.data?.checkoutId;
            const payment = await tx.payment.findUnique({ where: { abacateCheckoutId: checkoutId } });
            if (payment) {
              await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
              if (payment.planId) {
                const plan = await tx.plan.findUnique({ where: { id: payment.planId } });
                if (plan && plan.gbIncluded > 0) {
                  await tx.user.update({
                    where: { id: payment.userId },
                    data: { balanceGB: { decrement: plan.gbIncluded } },
                  });
                }
              }
            }
            break;
          }
          case "subscription.completed":
          case "subscription.renewed": {
            const subId = event.data?.id || event.data?.subscriptionId;
            const subscription = await tx.subscription.findUnique({ where: { abacatePaySubId: subId } });
            if (subscription) {
              const nextPeriod = new Date();
              nextPeriod.setMonth(nextPeriod.getMonth() + 1);
              await tx.subscription.update({
                where: { id: subscription.id },
                data: { status: "ACTIVE", currentPeriodEnd: nextPeriod },
              });
              if (subscription.planId) {
                await tx.user.update({
                  where: { id: subscription.userId },
                  data: { activePlanId: subscription.planId },
                });
              }
              await tx.payment.create({
                data: {
                  userId: subscription.userId,
                  planId: subscription.planId,
                  type: "SUBSCRIPTION",
                  amountCents: event.data?.amount || 0,
                  status: "PAID",
                  abacateSubId: subId,
                },
              });
            }
            break;
          }
          case "subscription.cancelled": {
            const subId = event.data?.id || event.data?.subscriptionId;
            const subscription = await tx.subscription.findUnique({ where: { abacatePaySubId: subId } });
            if (subscription) {
              await tx.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELED" } });
            }
            break;
          }
          default:
            console.log(`[Webhook] Evento não tratado: ${eventType}`);
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`[Webhook] Evento duplicado evitado: ${externalId}:${eventType}`);
        return apiSuccess({ received: true, duplicate: true });
      }
      console.error("[Webhook] Erro processando transação:", error);
      return apiError("Internal error", 500);
    }

    return apiSuccess({ received: true });
  } catch (error) {
    console.error("[Webhook] Erro crítico:", error);
    return apiSuccess({ received: true }); // Retornar 200 para não re-enviar
  }
}
