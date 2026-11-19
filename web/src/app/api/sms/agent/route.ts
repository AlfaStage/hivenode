import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { getAuthenticatedUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  bindingId, bindingList, cancelPending, consentVersion, destinationFingerprint, expireMessages, hashToken,
  isAdmitted, lockOwner, opaqueToken, realSendEnabled, reviewedDestinations, signGrant,
} from "@/lib/sms-pilot";

const eventCode = z.enum([
  "PERMISSION_REQUIRED", "SIM_UNAVAILABLE", "RADIO_OFF", "NO_SERVICE", "NETWORK_REJECTED",
  "PLATFORM_LIMIT", "PREMIUM_BLOCKED", "MODEM_ERROR", "MESSAGE_TOO_LONG", "INVOCATION_UNCERTAIN",
]);
const command = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("pair"), code: z.string().regex(/^smsp_[a-f0-9]{64}$/), label: z.string().trim().min(1).max(60) }),
  z.strictObject({ action: z.literal("poll"), bindings: bindingList, activeBinding: bindingId.nullable(),
    consentVersion: z.literal(consentVersion).nullable() }),
  z.strictObject({ action: z.literal("pause") }),
  z.strictObject({ action: z.literal("event"), messageId: z.uuid(), version: z.number().int().min(1).max(30),
    total: z.number().int().min(0).max(3), sent: z.number().int().min(0).max(3),
    delivered: z.number().int().min(0).max(3), failed: z.number().int().min(0).max(3), code: eventCode.nullable(),
  }).refine(event => event.delivered <= event.sent && event.sent + event.failed <= event.total),
]);

export async function POST(request: Request) {
  try {
    const data = command.parse(await request.json());
    if (data.action === "pair") {
      const profile = request.headers.has("authorization") ? await getAuthenticatedUser() : null;
      if (request.headers.has("authorization") && !profile) return apiError("Faça login para continuar", 401);
      const codeHash = hashToken(data.code);
      return await prisma.$transaction(async tx => {
        const pair = await tx.smsPilotPair.findUnique({ where: { codeHash } });
        if (!pair || (profile && profile.userId !== pair.userId)) return apiError("Código inválido ou de outra conta", 404);
        const owner = await lockOwner(tx, pair.userId);
        if (!isAdmitted(owner) || (profile && profile.version !== owner?.sessionVersion)) {
          return apiError("Código inválido ou expirado", 404);
        }
        const used = await tx.smsPilotPair.deleteMany({ where: { codeHash, expiresAt: { gt: new Date() } } });
        if (!used.count) return apiError("Código inválido ou expirado", 404);
        if (await tx.smsPilotDevice.count({ where: { userId: pair.userId, revokedAt: null } })) {
          return apiError("Esta conta já tem um aparelho no piloto", 409);
        }
        const token = opaqueToken("smsd_");
        const device = await tx.smsPilotDevice.create({
          data: { userId: pair.userId, label: data.label, tokenHash: hashToken(token) }, select: { id: true },
        });
        await tx.auditLog.create({ data: { actorId: pair.userId, action: "sms_pilot.device_pair", targetId: device.id } });
        return apiSuccess({ ...device, token }, 201);
      });
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.match(/^Bearer smsd_[a-f0-9]{64}$/)) return apiError("Vincule o aparelho novamente", 401);
    const agentToken = authorization.slice(7);
    const tokenHash = hashToken(agentToken);
    return await prisma.$transaction(async tx => {
      const target = await tx.smsPilotDevice.findUnique({ where: { tokenHash }, select: { id: true, userId: true } });
      if (!target) return apiError("Vincule o aparelho novamente", 401);
      const owner = await lockOwner(tx, target.userId);
      const device = await tx.smsPilotDevice.findUnique({ where: { id: target.id } });
      if (!device) return apiError("Vincule o aparelho novamente", 401);

      if (data.action === "event") {
        const message = await tx.smsPilotMessage.findFirst({ where: { id: data.messageId, deviceId: device.id } });
        if (!message || !message.grantExpiresAt) return apiError("Tentativa não encontrada", 404);
        if (data.version <= message.eventVersion) return apiSuccess({ received: true });
        if (data.sent < message.sentParts || data.delivered < message.deliveredParts || data.failed < message.failedParts ||
            (message.totalParts > 0 && data.total !== message.totalParts)) {
          return apiError("O relato anterior já contém contagens mais recentes", 409);
        }
        const allCallbacks = data.total > 0 && data.sent + data.failed === data.total;
        const state = data.total > 0 && data.delivered === data.total ? "DELIVERED"
          : allCallbacks && data.sent === data.total ? "SENT"
          : allCallbacks && data.sent > 0 ? "PARTIAL"
          : allCallbacks || (data.total === 0 && data.code && data.code !== "INVOCATION_UNCERTAIN") ? "FAILED"
          : data.code === "INVOCATION_UNCERTAIN" || message.state === "UNKNOWN" ||
            Date.now() - message.grantExpiresAt.getTime() >= 120_000 ? "UNKNOWN" : "AUTHORIZED";
        await tx.smsPilotMessage.update({ where: { id: message.id }, data: {
          state, sentParts: data.sent, deliveredParts: data.delivered, failedParts: data.failed,
          totalParts: data.total, errorCode: data.code, eventVersion: data.version,
        } });
        if (state !== message.state) await tx.auditLog.create({ data: { actorId: device.userId,
          action: "sms_pilot.agent_event", targetId: message.id, metadata: { state, version: data.version } } });
        return apiSuccess({ received: true });
      }

      if (!isAdmitted(owner) || device.revokedAt) return apiError("Aparelho ou conta sem acesso", 403);
      if (data.action === "pause") {
        await tx.smsPilotDevice.update({ where: { id: device.id }, data: { consentVersion: null, selectedBinding: null, lastSeenAt: null } });
        await cancelPending(tx, device.userId, device.id);
        return apiSuccess({ paused: true });
      }

      const now = new Date();
      const missing = (id: string | null) => id !== null && !data.bindings.some(line => line.id === id);
      const inventoryChanged = missing(device.approvedBinding) || missing(device.pendingBinding);
      await tx.smsPilotDevice.update({ where: { id: device.id }, data: {
        lastSeenAt: now, bindings: data.bindings, consentVersion: data.consentVersion, selectedBinding: data.activeBinding,
        ...(inventoryChanged ? { approvedBinding: null, approvedAt: null, pendingBinding: null,
          destinationHash: null, destinationMask: null, approvedDestinations: [] } : {}),
      } });
      if (inventoryChanged) await cancelPending(tx, device.userId, device.id);

      const approved = inventoryChanged ? [] : reviewedDestinations(device);
      let status = "READY";
      if (!realSendEnabled()) status = "SERVICE_PAUSED";
      else if (!approved.length) status = "APPROVAL_REQUIRED";
      else if (data.consentVersion !== consentVersion || device.approvedBinding !== data.activeBinding || missing(data.activeBinding)) status = "SIM_NOT_SELECTED";
      if (status !== "READY") return apiSuccess({ status, grant: null });

      await expireMessages(tx, now, device.userId);
      const outstanding = await tx.smsPilotMessage.findFirst({ where: { deviceId: device.id, state: "AUTHORIZED" }, select: { id: true } });
      if (outstanding) return apiSuccess({ status: "WAITING_MODEM", grant: null });
      const message = await tx.smsPilotMessage.findFirst({
        where: { deviceId: device.id, userId: device.userId, state: "QUEUED", expiresAt: { gt: now }, bindingId: device.approvedBinding! },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (!message?.encryptedPayload) return apiSuccess({ status, grant: null });
      const { to, text } = z.object({ to: z.string(), text: z.string() }).parse(JSON.parse(decrypt(message.encryptedPayload)));
      const hash = destinationFingerprint(device.userId, to);
      if (!approved.some(item => item.hash === hash)) {
        await tx.smsPilotMessage.update({ where: { id: message.id }, data: { state: "CANCELED", encryptedPayload: null } });
        return apiSuccess({ status, grant: null });
      }
      const grantExpiresAt = new Date(now.getTime() + 30_000);
      const payload = Buffer.from(JSON.stringify({ id: message.id, deviceId: device.id, bindingId: message.bindingId, to, text,
        issuedAt: now.getTime(), expiresAt: grantExpiresAt.getTime() })).toString("base64url");
      const claimed = await tx.smsPilotMessage.updateMany({
        where: { id: message.id, state: "QUEUED", expiresAt: { gt: new Date() } },
        data: { state: "AUTHORIZED", grantExpiresAt, encryptedPayload: null },
      });
      if (!claimed.count) return apiSuccess({ status, grant: null });
      await tx.auditLog.create({ data: { actorId: device.userId, action: "sms_pilot.authorize", targetId: message.id,
        metadata: { deviceId: device.id, bindingId: message.bindingId } } });
      return apiSuccess({ status, grant: { payload, signature: signGrant(agentToken, payload) } });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
