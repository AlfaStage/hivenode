// ==============================================================================
// API Route: Admin Payment Key (AbacatePay API Key Management)
// ==============================================================================

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET: Verifica se existe uma key salva (NUNCA retorna a key)
export async function GET() {
  try {
    await requireAdmin();

    const config = await prisma.systemConfig.findUnique({
      where: { key: "abacatepay_api_key" },
    });

    const webhookConfig = await prisma.systemConfig.findUnique({
      where: { key: "abacatepay_webhook_secret" },
    });

    return apiSuccess({
      hasApiKey: !!config?.value,
      hasWebhookSecret: !!webhookConfig?.value,
      apiKeyLastChars: config?.value ? `•••••${config.value.slice(-4)}` : null,
      updatedAt: config?.updatedAt || null,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao verificar chave", 500);
  }
}

// POST: Salva a API Key (encriptada no banco)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    if (body.apiKey) {
      await prisma.systemConfig.upsert({
        where: { key: "abacatepay_api_key" },
        update: { value: body.apiKey },
        create: { key: "abacatepay_api_key", value: body.apiKey },
      });
    }

    if (body.webhookSecret) {
      await prisma.systemConfig.upsert({
        where: { key: "abacatepay_webhook_secret" },
        update: { value: body.webhookSecret },
        create: { key: "abacatepay_webhook_secret", value: body.webhookSecret },
      });
    }

    return apiSuccess({ message: "Chaves salvas com sucesso!" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao salvar chaves", 500);
  }
}
