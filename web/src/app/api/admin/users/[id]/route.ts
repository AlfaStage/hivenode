import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { brokerCommand } from "@/lib/broker";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    if (body.role !== undefined && !["ADMIN", "CUSTOMER"].includes(body.role)) return apiError("Papel inválido", 400);
    for (const key of ["balanceGB", "hivePoints"]) {
      if (body[key] !== undefined && (typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0)) return apiError("Saldo inválido", 400);
    }
    if (id === actor.userId && (body.disabled || body.role === "CUSTOMER")) return apiError("Não é possível revogar seu próprio acesso", 400);

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: body.role,
        balanceGB: body.balanceGB !== undefined ? Number(body.balanceGB) : undefined,
        hivePoints: body.hivePoints !== undefined ? Number(body.hivePoints) : undefined,
        walletAddress: body.walletAddress !== undefined ? body.walletAddress : undefined,
        disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
        sessionVersion: { increment: 1 },
      },
    });

    await prisma.auditLog.create({ data: { actorId: actor.userId, action: "user.update", targetId: id } });
    await brokerCommand("/internal/revoke", { userId: id }).catch(console.error);
    return apiSuccess({ user: { id: user.id, email: user.email, role: user.role, balanceGB: user.balanceGB, hivePoints: user.hivePoints } });
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
    await brokerCommand("/internal/revoke", { userId: id }).catch(console.error);

    return apiSuccess({ message: "Usuário excluído com sucesso." });
  } catch (error: any) {
    console.error("[API Admin User Delete]", error);
    return apiError("Erro ao excluir usuário", 500);
  }
}
