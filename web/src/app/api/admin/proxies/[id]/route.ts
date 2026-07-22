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

    const proxy = await prisma.proxyCredential.update({
      where: { id },
      data: {
        status: body.status as NodeStatus,
      },
    });

    return apiSuccess({ proxy });
  } catch (error: any) {
    console.error("[API Admin Proxy Edit]", error);
    return apiError("Erro ao editar proxy", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await prisma.proxyCredential.delete({
      where: { id },
    });

    return apiSuccess({ message: "Proxy excluído com sucesso." });
  } catch (error: any) {
    console.error("[API Admin Proxy Delete]", error);
    return apiError("Erro ao excluir proxy", 500);
  }
}
