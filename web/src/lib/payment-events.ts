import { nextBillingPeriod } from "./billing-period";
import { createHash } from "node:crypto";
import { z } from "zod";
import { serializable } from "./transactions";
import type { Prisma } from "@prisma/client";

const resource = z.object({ id: z.string(), amount: z.number().optional(), paidAmount: z.number().optional(),
  status: z.string().optional(), updatedAt: z.string().optional(), frequency: z.string().optional() }).passthrough();
const schema = z.object({ id: z.string().optional(), event: z.string(), devMode: z.boolean().optional(),
  data: z.object({ checkout: resource.optional(), subscription: resource.optional(), payment: resource.optional() }).passthrough() }).passthrough();

export async function processPaymentEvent(input: unknown) {
  const event = schema.parse(input);
  if (event.devMode && process.env.APP_ENV === "production") throw new Error("Sandbox event rejected");
  const externalId = event.id || createHash("sha256").update(JSON.stringify(event)).digest("hex");
  return serializable(async tx => {
    if (await tx.webhookEvent.findUnique({ where: { externalId } })) return { duplicate: true };
    const checkout = event.data.checkout;
    const subscription = event.data.subscription;
    if (event.event === "checkout.completed" || event.event === "checkout.refunded") {
      if (!checkout) throw new Error("Missing checkout");
      const payment = await tx.payment.findUnique({ where: { abacateCheckoutId: checkout.id } });
      if (!payment) throw new Error("Checkout not recorded yet");
      const metadata = (payment.metadata || {}) as { gbIncluded?: number };
      const gb = metadata.gbIncluded || 0;
      if (event.event === "checkout.completed" && payment.status === "PENDING") {
        if (checkout.status !== "PAID" || (checkout.paidAmount ?? checkout.amount ?? -1) < payment.amountCents) throw new Error("Payment amount/status mismatch");
        await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID" } });
        await tx.user.update({ where: { id: payment.userId }, data: { balanceGB: { increment: gb } } });
      } else if (event.event === "checkout.refunded" && payment.status === "PAID") {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
        await tx.user.update({ where: { id: payment.userId }, data: { balanceGB: { decrement: gb } } });
      }
    } else if (["subscription.completed", "subscription.renewed", "subscription.cancelled", "subscription.payment_failed"].includes(event.event)) {
      if (!subscription) throw new Error("Missing subscription");
      const local = await tx.subscription.findUnique({ where: { abacatePaySubId: subscription.id }, include: { plan: true } });
      if (!local) throw new Error("Subscription not recorded yet");
      if (event.event === "subscription.cancelled") {
        await tx.subscription.update({ where: { id: local.id }, data: { status: "CANCELED" } });
      } else if (event.event === "subscription.payment_failed") {
        if (local.currentPeriodEnd <= new Date()) await tx.subscription.update({ where: { id: local.id }, data: { status: "PAST_DUE" } });
      } else {
        const chargeId = event.data.payment?.id || checkout?.id;
        if (!chargeId) throw new Error("Missing payment identity");
        if (!await tx.payment.findUnique({ where: { externalPaymentId: chargeId } })) {
          const amount = event.data.payment?.paidAmount ?? checkout?.paidAmount ?? subscription.amount ?? 0;
          if (!local.plan || amount < local.plan.priceInCents) throw new Error("Payment amount mismatch");
          const paidAt = new Date(event.data.payment?.updatedAt || checkout?.updatedAt || subscription.updatedAt || "");
          if (!Number.isFinite(paidAt.getTime())) throw new Error("Missing valid payment date");
          const start = local.status === "ACTIVE" && local.currentPeriodEnd > paidAt ? local.currentPeriodEnd : paidAt;
          const end = nextBillingPeriod(start, local.plan.billingCycle === "YEARLY");
          await tx.subscription.update({ where: { id: local.id }, data: { status: "ACTIVE", currentPeriodEnd: end } });
          await tx.payment.create({ data: { userId: local.userId, planId: local.planId, type: "SUBSCRIPTION", amountCents: amount,
            status: "PAID", abacateSubId: subscription.id, externalPaymentId: chargeId } });
          await tx.user.update({ where: { id: local.userId }, data: { balanceGB: { increment: local.plan.gbIncluded }, activePlanId: local.planId } });
        }
      }
    }
    await tx.webhookEvent.create({ data: { externalId, eventType: event.event, payload: event as Prisma.InputJsonValue } });
    return { duplicate: false };
  });
}
