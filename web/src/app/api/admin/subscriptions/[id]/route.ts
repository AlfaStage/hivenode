import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { SubStatus } from "@prisma/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const subscription = await prisma.subscription.update({
      where: { id },
      data: {
        status: body.status as SubStatus,
        planType: body.planType,
      },
    });

    return apiSuccess({ subscription });
  } catch (error: any) {
    console.error("[API Admin Subscription Edit]", error);
    return apiError("Erro ao editar assinatura", 500);
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
  } catch (error: any) {
    console.error("[API Admin Subscription Delete]", error);
    return apiError("Erro ao remover assinatura", 500);
  }
}
