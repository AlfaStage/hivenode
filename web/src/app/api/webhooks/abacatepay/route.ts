// ==============================================================================
// API Route: POST /api/webhooks/abacatepay
// ==============================================================================

import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/utils";

// Função para validar a assinatura do webhook (v2)
function verifySignature(payload: string, signature: string, secret: string) {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return signature === digest;
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-abacate-signature");
    if (!signature) {
      return apiError("Missing signature", 401);
    }

    const rawBody = await request.text();
    const secret = process.env.ABACATE_PAY_WEBHOOK_SECRET!;

    if (!verifySignature(rawBody, signature, secret)) {
      return apiError("Invalid signature", 401);
    }

    const event = JSON.parse(rawBody);

    // Processamento do evento `payment.success`
    if (event.type === "payment.success") {
      const { customerEmail, amountBRL } = event.data;
      
      // Conversão: R$ 5,00 = 1 GB (Exemplo)
      const gbPurchased = amountBRL / 5.0;

      const user = await prisma.user.findUnique({
        where: { email: customerEmail },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            balanceGB: { increment: gbPurchased },
          },
        });

        // Desbloquear os nodes se estavam bloqueados por falta de saldo
        await prisma.node.updateMany({
          where: { userId: user.id, status: "BLOCKED" },
          data: { status: "OFFLINE" }, // OFFLINE aguardando reconexão
        });

        console.log(`[Webhook] ✅ Recarga de ${gbPurchased} GB para ${user.email}`);
      }
    }

    return apiSuccess({ received: true });
  } catch (error) {
    console.error("[Webhook] Erro:", error);
    return apiError("Internal server error", 500);
  }
}
