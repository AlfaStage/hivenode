// ==============================================================================
// API Route: Admin Plans CRUD
// ==============================================================================

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET: Listar todos os planos
export async function GET() {
  try {
    await requireAdmin();
    const plans = await prisma.plan.findMany({
      orderBy: [{ category: "asc" }, { priceInCents: "asc" }],
    });
    return apiSuccess({ plans });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao listar planos", 500);
  }
}

// POST: Criar novo plano
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const plan = await prisma.plan.create({
      data: {
        slug: body.slug,
        name: body.name,
        category: body.category,
        priceInCents: body.priceInCents || 0,
        maxDevices: body.maxDevices || 0,
        maxProxies: body.maxProxies || 0,
        gbIncluded: body.gbIncluded || 0,
        gbPriceCents: body.gbPriceCents || 0,
        isRecurring: body.isRecurring || false,
        billingCycle: body.billingCycle || null,
        isPublic: body.isPublic ?? true,
        isAdminOnly: body.isAdminOnly || false,
        extraDeviceCents: body.extraDeviceCents || 0,
        extraProxyCents: body.extraProxyCents || 0,
        minMonthsForPPU: body.minMonthsForPPU || 0,
        minAvgGbForPPU: body.minAvgGbForPPU || 0,
      },
    });

    return apiSuccess({ plan });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao criar plano", 500);
  }
}

// PUT: Atualizar plano existente
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, applyToExisting, ...data } = body;

    if (!id) return apiError("ID do plano é obrigatório", 400);

    const plan = await prisma.plan.update({
      where: { id },
      data,
    });

    // Se applyToExisting, atualizar todos os usuários que têm esse plano
    if (applyToExisting) {
      // Buscar subscriptions ativas deste plano e atualizar tipo
      await prisma.subscription.updateMany({
        where: { planId: id, status: "ACTIVE" },
        data: { updatedAt: new Date() },
      });
      console.log(`[Admin] Plano ${plan.name} atualizado e aplicado a usuários existentes`);
    }

    return apiSuccess({ plan, appliedToExisting: !!applyToExisting });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao atualizar plano", 500);
  }
}
