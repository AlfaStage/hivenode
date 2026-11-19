import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { brokerCommand } from "@/lib/broker";
import { z } from "zod";
import { isSmsBetaSameOrigin } from "@/lib/sms-beta-origin";
import { cancelPending } from "@/lib/sms-pilot";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const beta = z.union([
      z.strictObject({ minerBetaAccess: z.boolean() }),
      z.strictObject({ smsBetaAccess: z.boolean() }),
    ]).parse(await request.json());

    if ("smsBetaAccess" in beta) {
      if (!isSmsBetaSameOrigin(request)) return apiError("Origem não autorizada", 403);
      const { smsBetaAccess } = beta;
      return await prisma.$transaction(async tx => {
        const user = await tx.user.update({ where: { id }, data: { smsBetaAccess }, select: { role: true } });
        await tx.auditLog.create({ data: { actorId: actor.userId, targetId: id,
          action: smsBetaAccess ? "sms_beta.grant" : "sms_beta.revoke" } });
        if (!smsBetaAccess && user.role !== "ADMIN") {
          await tx.smsBetaMessage.updateMany({ where: { userId: id, state: "QUEUED" }, data: { state: "CANCELED" } });
          await cancelPending(tx, id);
          await tx.smsPilotPair.deleteMany({ where: { userId: id } });
          await tx.smsPilotKey.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
          await tx.smsPilotDevice.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        return apiSuccess({ smsBetaAccess });
      });
    }

    const { minerBetaAccess } = beta;
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { minerBetaAccess } }),
      prisma.auditLog.create({
        data: { actorId: actor.userId, targetId: id, action: minerBetaAccess ? "miner_beta.grant" : "miner_beta.revoke" },
      }),
    ]);

    if (!minerBetaAccess) {
      const nodes = await prisma.node.findMany({ where: { userId: id, visibility: "PUBLIC" }, select: { id: true } });
      await Promise.allSettled(nodes.map(node => brokerCommand("/internal/revoke", { nodeId: node.id })));
    }

    return apiSuccess({ minerBetaAccess });
  } catch (error) {
    return handleApiError(error);
  }
}

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
  } catch (error: unknown) {
    console.error("[API Admin User Edit]", error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    if (id === actor.userId) return apiError("Não é possível excluir sua própria conta administrativa", 400);

    await prisma.user.delete({
      where: { id },
    });
    await brokerCommand("/internal/revoke", { userId: id }).catch(console.error);

    return apiSuccess({ message: "Usuário excluído com sucesso." });
  } catch (error: unknown) {
    console.error("[API Admin User Delete]", error);
    return handleApiError(error);
  }
}
