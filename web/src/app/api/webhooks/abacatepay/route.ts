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

    switch (eventType) {
      // ===============================================================
      // CHECKOUT (Compra Única - Pacotes GB)
      // ===============================================================
      case "checkout.completed": {
        const checkoutId = event.data?.id || event.data?.checkoutId;
        const payment = await prisma.payment.findFirst({
          where: { abacateCheckoutId: checkoutId },
        });

        if (payment) {
          // Atualizar status do pagamento
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "PAID" },
          });

          // Buscar plano para saber quantos GB creditar
          if (payment.planId) {
            const plan = await prisma.plan.findUnique({
              where: { id: payment.planId },
            });

            if (plan && plan.gbIncluded > 0) {
              await prisma.user.update({
                where: { id: payment.userId },
                data: {
                  balanceGB: { increment: plan.gbIncluded },
                  activePlanId: plan.id,
                },
              });
              console.log(`[Webhook] ✅ +${plan.gbIncluded} GB para user ${payment.userId}`);
            }
          }

          // Desbloquear nodes se estavam bloqueados
          await prisma.node.updateMany({
            where: { userId: payment.userId, status: "BLOCKED" },
            data: { status: "OFFLINE" },
          });
        }
        break;
      }

      case "checkout.refunded": {
        const checkoutId = event.data?.id || event.data?.checkoutId;
        const payment = await prisma.payment.findFirst({
          where: { abacateCheckoutId: checkoutId },
        });

        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "REFUNDED" },
          });

          // Reverter GB se tinha plano
          if (payment.planId) {
            const plan = await prisma.plan.findUnique({ where: { id: payment.planId } });
            if (plan && plan.gbIncluded > 0) {
              await prisma.user.update({
                where: { id: payment.userId },
                data: { balanceGB: { decrement: plan.gbIncluded } },
              });
              console.log(`[Webhook] ↩️ -${plan.gbIncluded} GB (estorno) user ${payment.userId}`);
            }
          }
        }
        break;
      }

      // ===============================================================
      // ASSINATURA (Planos Recorrentes - Starter/Pro/Enterprise)
      // ===============================================================
      case "subscription.completed":
      case "subscription.renewed": {
        const subId = event.data?.id || event.data?.subscriptionId;
        const subscription = await prisma.subscription.findFirst({
          where: { abacatePaySubId: subId },
        });

        if (subscription) {
          const nextPeriod = new Date();
          nextPeriod.setMonth(nextPeriod.getMonth() + 1);

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: "ACTIVE",
              currentPeriodEnd: nextPeriod,
            },
          });

          // Atualizar plano ativo do usuário
          if (subscription.planId) {
            await prisma.user.update({
              where: { id: subscription.userId },
              data: { activePlanId: subscription.planId },
            });
          }

          // Registrar pagamento
          await prisma.payment.create({
            data: {
              userId: subscription.userId,
              planId: subscription.planId,
              type: "SUBSCRIPTION",
              amountCents: event.data?.amount || 0,
              status: "PAID",
              abacateSubId: subId,
            },
          });

          console.log(`[Webhook] ✅ Assinatura ${eventType === "subscription.renewed" ? "renovada" : "ativada"} - user ${subscription.userId}`);
        }
        break;
      }

      case "subscription.cancelled": {
        const subId = event.data?.id || event.data?.subscriptionId;
        const subscription = await prisma.subscription.findFirst({
          where: { abacatePaySubId: subId },
        });

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: "CANCELED" },
          });

          console.log(`[Webhook] 🛑 Assinatura cancelada - user ${subscription.userId}`);
        }
        break;
      }

      // ===============================================================
      // EVENTOS NÃO TRATADOS (Log apenas)
      // ===============================================================
      default:
        console.log(`[Webhook] Evento não tratado: ${eventType}`);
    }

    return apiSuccess({ received: true });
  } catch (error) {
    console.error("[Webhook] Erro crítico:", error);
    return apiSuccess({ received: true }); // Retornar 200 para não re-enviar
  }
}
