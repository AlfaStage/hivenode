import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { visibleNumber } from "@/lib/sms-gateway";
import {
  bindingId, bindingList, cancelPending, consentVersion, destination, hashToken,
  destinationFingerprint, maskPhone, maxApprovedDestinations, opaqueToken, realSendEnabled, reviewedDestinations, withPilotAccess,
} from "@/lib/sms-pilot";

const command = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("pair") }),
  z.strictObject({ action: z.literal("revoke-device"), deviceId: z.uuid() }),
  z.strictObject({ action: z.literal("revoke-destination"), deviceId: z.uuid(), destinationId: z.uuid() }),
  z.strictObject({ action: z.literal("issue-key") }),
  z.strictObject({ action: z.literal("revoke-key") }),
  z.strictObject({ action: z.literal("request-approval"), deviceId: z.uuid(), bindingId,
    destination, verifiedByOwner: z.literal(true), consentVersion: z.literal(consentVersion) }),
]);

export async function GET(request: Request) {
  return withPilotAccess(request, true, async (tx, userId, role) => {
    const devices = await tx.smsPilotDevice.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: "desc" },
      select: { id: true, label: true, bindings: true, approvedBinding: true, pendingBinding: true, approvedAt: true,
        consentVersion: true, selectedBinding: true, lastSeenAt: true, destinationHash: true, destinationMask: true,
        approvedDestinations: true, gateway: true, gatewayEnabled: true,
        gatewaySims: { where: { available: true }, orderBy: { slot: "asc" },
          select: { id: true, label: true, slot: true, encryptedNumber: true } } } });
    const key = role === "API_KEY" ? null : await tx.smsPilotKey.findFirst({
      where: { userId, revokedAt: null }, select: { id: true, createdAt: true },
    });
    const visibleDevices = devices.map(device => {
      const approved = reviewedDestinations(device).map(({ id, mask }) => ({ id, mask }));
      const { id, label, bindings, approvedBinding, pendingBinding, approvedAt, consentVersion, selectedBinding, lastSeenAt, destinationMask } = device;
      return { id, label, bindings, approvedBinding, pendingBinding, approvedAt, consentVersion, selectedBinding, lastSeenAt,
        destinationMask: pendingBinding ? destinationMask : approved[0]?.mask ?? null,
        approvedDestinations: approved, gateway: device.gateway, gatewayEnabled: device.gatewayEnabled };
    });
    const sims = devices.flatMap(device => device.gatewaySims.map(sim => ({
      simId: sim.id, slot: sim.slot, carrier: sim.label, phoneNumber: visibleNumber(sim.encryptedNumber),
      deviceLabel: device.label, deviceId: device.id, enabled: device.gatewayEnabled,
      online: !!device.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 45_000,
    })));
    return apiSuccess({ devices: visibleDevices, sims, key, canApprove: role === "ADMIN", realSendEnabled: realSendEnabled(),
      consentVersion, maxApprovedDestinations });
  });
}

export async function POST(request: Request) {
  return withPilotAccess(request, false, async (tx, userId) => {
    const data = command.parse(await request.json());
    const now = new Date();
    switch (data.action) {
      case "pair": {
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
        if (device.gateway) return apiError("O gateway usa o consentimento informado no envio", 409);
        const bindings = bindingList.parse(device.bindings);
        if (!device.lastSeenAt || now.getTime() - device.lastSeenAt.getTime() > 90_000 ||
            device.consentVersion !== consentVersion || device.selectedBinding !== data.bindingId ||
            !bindings.some(line => line.id === data.bindingId)) {
          return apiError("Abra o app e confirme o chip antes de solicitar a aprovação", 409);
        }
        const sameLine = device.approvedBinding === data.bindingId && !!device.approvedAt;
        const approved = sameLine ? reviewedDestinations(device) : [];
        const hash = destinationFingerprint(userId, data.destination);
        if (approved.some(item => item.hash === hash)) return apiError("Este destino já está aprovado para o chip", 409);
        if (approved.length >= maxApprovedDestinations) return apiError("Limite de 5 destinos aprovados por chip no piloto", 409);
        if (sameLine && device.pendingBinding) return apiError("Aguarde a revisão do número pendente antes de cadastrar outro", 409);
        await tx.smsPilotDevice.update({ where: { id: device.id }, data: {
          ...(sameLine ? {} : { approvedBinding: null, approvedAt: null }),
          approvedDestinations: approved, pendingBinding: data.bindingId,
          destinationHash: hash, destinationMask: maskPhone(data.destination),
        } });
        if (!sameLine) await cancelPending(tx, userId, device.id);
        await tx.auditLog.create({ data: { actorId: userId, action: "sms_pilot.line_request", targetId: device.id,
          metadata: { bindingId: data.bindingId, consentVersion } } });
        return apiSuccess({ pending: true }, 201);
      }
      case "revoke-destination": {
        const device = await tx.smsPilotDevice.findFirst({ where: { id: data.deviceId, userId, revokedAt: null } });
        if (!device) return apiError("Aparelho não encontrado", 404);
        const approved = reviewedDestinations(device);
        const removed = approved.find(item => item.id === data.destinationId);
        if (!removed) return apiError("Destino aprovado não encontrado", 404);
        await tx.smsPilotDevice.update({ where: { id: device.id }, data: {
          approvedDestinations: approved.filter(item => item.id !== removed.id),
          ...(device.pendingBinding ? {} : { destinationHash: null, destinationMask: null }),
        } });
        await tx.smsPilotMessage.updateMany({ where: { userId, deviceId: device.id, state: "QUEUED", destinationHash: removed.hash },
          data: { state: "CANCELED", encryptedPayload: null } });
        await tx.auditLog.create({ data: { actorId: userId, action: "sms_pilot.destination_revoke", targetId: removed.id,
          metadata: { deviceId: device.id, bindingId: device.approvedBinding } } });
        return apiSuccess({ revoked: true });
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
