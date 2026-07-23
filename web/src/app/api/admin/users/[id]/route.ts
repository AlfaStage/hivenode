import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: body.role,
        balanceGB: body.balanceGB !== undefined ? Number(body.balanceGB) : undefined,
        hivePoints: body.hivePoints !== undefined ? Number(body.hivePoints) : undefined,
        walletAddress: body.walletAddress !== undefined ? body.walletAddress : undefined,
        twoFactorEnabled: body.twoFactorEnabled !== undefined ? Boolean(body.twoFactorEnabled) : undefined,
      },
    });

    return apiSuccess({ user });
  } catch (error: any) {
    console.error("[API Admin User Edit]", error);
    return apiError("Erro ao editar usuário", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await prisma.user.delete({
      where: { id },
    });

    return apiSuccess({ message: "Usuário excluído com sucesso." });
  } catch (error: any) {
    console.error("[API Admin User Delete]", error);
    return apiError("Erro ao excluir usuário", 500);
  }
}
