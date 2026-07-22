import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { NodeStatus } from "@prisma/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const node = await prisma.node.update({
      where: { id },
      data: {
        status: body.status as NodeStatus,
      },
    });

    return apiSuccess({ node });
  } catch (error: any) {
    console.error("[API Admin Node Edit]", error);
    return apiError("Erro ao editar aparelho", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await prisma.node.delete({
      where: { id },
    });

    return apiSuccess({ message: "Aparelho excluído com sucesso." });
  } catch (error: any) {
    console.error("[API Admin Node Delete]", error);
    return apiError("Erro ao excluir aparelho", 500);
  }
}
