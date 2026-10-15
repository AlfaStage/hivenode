import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { z } from "zod";
import { SubStatus, PlanType } from "@prisma/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = z.object({ status: z.enum(SubStatus), planType: z.enum(PlanType).optional() }).parse(await request.json());

    const subscription = await prisma.subscription.update({
      where: { id },
      data: {
        status: body.status as SubStatus,
        planType: body.planType,
      },
    });

    return apiSuccess({ subscription });
  } catch (error: unknown) {
    console.error("[API Admin Subscription Edit]", error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await prisma.subscription.delete({
      where: { id },
    });

    return apiSuccess({ message: "Assinatura removida com sucesso." });
  } catch (error: unknown) {
    console.error("[API Admin Subscription Delete]", error);
    return handleApiError(error);
  }
}
