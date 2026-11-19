import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSmsBetaSameOrigin } from "@/lib/sms-beta-origin";
import { bindingId, bindingList, cancelPending, consentVersion, isAdmitted, lockOwner, maxApprovedDestinations,
  privateHash, reviewedDestinations } from "@/lib/sms-pilot";

function reviewToken(id: string, binding: string | null, destinationHash: string | null) {
  return privateHash(["line-review-v1", id, binding, destinationHash]);
}

export async function GET() {
  try {
    await requireAdmin();
    const pending = await prisma.smsPilotDevice.findMany({ where: { pendingBinding: { not: null }, revokedAt: null },
      select: { id: true, label: true, pendingBinding: true, approvedBinding: true, destinationMask: true, destinationHash: true, bindings: true,
        user: { select: { email: true } } }, take: 50, orderBy: { createdAt: "desc" } });
    return apiSuccess({ pending: pending.map(({ destinationHash, ...item }) => ({
      ...item, approvalToken: reviewToken(item.id, item.pendingBinding, destinationHash),
    })) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!isSmsBetaSameOrigin(request)) return apiError("Origem não autorizada", 403);
    const data = z.strictObject({ deviceId: z.uuid(), bindingId, action: z.enum(["approve", "decline", "revoke"]),
      approvalToken: z.string().regex(/^[a-f0-9]{64}$/).optional(), carrierReviewed: z.boolean().optional() }).parse(await request.json());
    if (data.action === "approve" && !data.carrierReviewed) return apiError("Confirme a permissão do plano desta linha", 400);
    return await prisma.$transaction(async tx => {
      const target = await tx.smsPilotDevice.findUnique({ where: { id: data.deviceId } });
      if (!target) return apiError("Aparelho não encontrado", 404);
      if (!isAdmitted(await lockOwner(tx, target.userId))) return apiError("Conta indisponível no beta", 409);
      const device = await tx.smsPilotDevice.findUnique({ where: { id: target.id } });
      const expected = data.action === "revoke" ? device?.approvedBinding : device?.pendingBinding;
      if (!device || device.revokedAt || expected !== data.bindingId) return apiError("A aprovação mudou ou a linha foi removida", 409);
      if (data.action !== "revoke" && data.approvalToken !== reviewToken(device.id, expected, device.destinationHash)) {
        return apiError("A solicitação foi alterada. Revise a linha e o destino novamente.", 409);
      }
      const approving = data.action === "approve";
      const sameLine = device.approvedBinding === data.bindingId && !!device.approvedAt;
      const approved = sameLine ? reviewedDestinations(device) : [];
      if (approving) {
        if (device.consentVersion !== consentVersion || device.selectedBinding !== data.bindingId ||
            !device.destinationHash || !device.destinationMask || !device.lastSeenAt ||
            Date.now() - device.lastSeenAt.getTime() > 90_000 ||
            !bindingList.parse(device.bindings).some(line => line.id === data.bindingId)) {
          return apiError("O chip precisa estar disponível e confirmado no app", 409);
        }
        if (approved.length >= maxApprovedDestinations) return apiError("Limite de destinos aprovados neste chip", 409);
        if (approved.some(item => item.hash === device.destinationHash)) return apiError("Este destino já está aprovado", 409);
        approved.push({ id: randomUUID(), hash: device.destinationHash, mask: device.destinationMask });
      }
      const keepLine = approving || (data.action === "decline" && sameLine);
      await tx.smsPilotDevice.update({ where: { id: device.id }, data: {
        approvedBinding: keepLine ? data.bindingId : null, approvedAt: keepLine ? device.approvedAt ?? new Date() : null,
        approvedDestinations: keepLine ? approved : [],
        pendingBinding: null, destinationHash: null, destinationMask: null,
      } });
      if (!keepLine) await cancelPending(tx, device.userId, device.id);
      await tx.auditLog.create({ data: { actorId: admin.userId, action: "sms_pilot.line_" + data.action,
        targetId: device.id, metadata: { bindingId: data.bindingId, consentVersion } } });
      return apiSuccess({ approved: approving });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
