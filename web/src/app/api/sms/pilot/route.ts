import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-utils";
import {
  bindingId, bindingList, cancelPending, consentVersion, destination, hashToken,
  maskPhone, opaqueToken, privateHash, realSendEnabled, withPilotAccess,
} from "@/lib/sms-pilot";

const command = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("pair") }),
  z.strictObject({ action: z.literal("revoke-device"), deviceId: z.uuid() }),
  z.strictObject({ action: z.literal("issue-key") }),
  z.strictObject({ action: z.literal("revoke-key") }),
  z.strictObject({ action: z.literal("request-approval"), deviceId: z.uuid(), bindingId,
    destination, verifiedByOwner: z.literal(true), consentVersion: z.literal(consentVersion) }),
]);

export async function GET(request: Request) {
  return withPilotAccess(request, true, async (tx, userId, role) => {
    const devices = await tx.smsPilotDevice.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: "desc" },
      select: { id: true, label: true, bindings: true, approvedBinding: true, pendingBinding: true, approvedAt: true,
        consentVersion: true, selectedBinding: true, lastSeenAt: true, destinationMask: true } });
    const key = role === "API_KEY" ? null : await tx.smsPilotKey.findFirst({
      where: { userId, revokedAt: null }, select: { id: true, createdAt: true },
    });
    return apiSuccess({ devices, key, canApprove: role === "ADMIN", realSendEnabled: realSendEnabled(), consentVersion });
  });
}

export async function POST(request: Request) {
  return withPilotAccess(request, false, async (tx, userId) => {
    const data = command.parse(await request.json());
    const now = new Date();
    switch (data.action) {
      case "pair": {
        const active = await tx.smsPilotDevice.count({ where: { userId, revokedAt: null } });
        if (active) return apiError("Desvincule o aparelho anterior para parear outro", 409);
        const code = opaqueToken("smsp_");
        const expiresAt = new Date(now.getTime() + 300_000);
        await tx.smsPilotPair.deleteMany({ where: { userId } });
        await tx.smsPilotPair.create({ data: { codeHash: hashToken(code), userId, expiresAt } });
        return apiSuccess({ code, expiresAt }, 201);
      }
      case "revoke-device": {
        const revoked = await tx.smsPilotDevice.updateMany({
          where: { id: data.deviceId, userId, revokedAt: null }, data: { revokedAt: now },
        });
        if (!revoked.count) return apiError("Aparelho não encontrado", 404);
        await cancelPending(tx, userId, data.deviceId);
        await tx.auditLog.create({ data: { actorId: userId, action: "sms_pilot.device_revoke", targetId: data.deviceId } });
        return apiSuccess({ revoked: true });
      }
      case "request-approval": {
        if (!process.env.SMS_PILOT_LOOKUP_KEY?.match(/^[a-f0-9]{64}$/i)) return apiError("A revisão de linha ainda está indisponível", 503);
        const device = await tx.smsPilotDevice.findFirst({ where: { id: data.deviceId, userId, revokedAt: null } });
        if (!device) return apiError("Aparelho não encontrado", 404);
        const bindings = bindingList.parse(device.bindings);
        if (!device.lastSeenAt || now.getTime() - device.lastSeenAt.getTime() > 90_000 ||
            device.consentVersion !== consentVersion || device.selectedBinding !== data.bindingId ||
            !bindings.some(line => line.id === data.bindingId)) {
          return apiError("Abra o app e confirme o chip antes de solicitar a aprovação", 409);
        }
        await tx.smsPilotDevice.update({ where: { id: device.id }, data: {
          approvedBinding: null, approvedAt: null, pendingBinding: data.bindingId,
          destinationHash: privateHash(["destination-v1", userId, data.destination]), destinationMask: maskPhone(data.destination),
        } });
        await cancelPending(tx, userId, device.id);
        await tx.auditLog.create({ data: { actorId: userId, action: "sms_pilot.line_request", targetId: device.id,
          metadata: { bindingId: data.bindingId, consentVersion } } });
        return apiSuccess({ pending: true }, 201);
      }
      case "issue-key": {
        await tx.smsPilotKey.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
        const token = opaqueToken("smsk_");
        const key = await tx.smsPilotKey.create({ data: { userId, tokenHash: hashToken(token) }, select: { id: true } });
        await tx.auditLog.create({ data: { actorId: userId, action: "sms_pilot.key_issue", targetId: key.id } });
        return apiSuccess({ ...key, token }, 201);
      }
      case "revoke-key": {
        await tx.smsPilotKey.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
        await tx.auditLog.create({ data: { actorId: userId, action: "sms_pilot.key_revoke", targetId: userId } });
        return apiSuccess({ revoked: true });
      }
    }
  });
}
