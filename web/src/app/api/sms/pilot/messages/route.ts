import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { encrypt } from "@/lib/crypto";
import { registerConsentedContact } from "@/lib/sms-gateway";
import { consentVersion, destination, destinationFingerprint, expireMessages, maskPhone, messageFields, privateHash,
  realSendEnabled, reviewedDestinations, withPilotAccess } from "@/lib/sms-pilot";

const fields = { destination, text: z.string().trim().min(1).max(420) };
const create = z.union([
  z.strictObject({ simId: z.uuid(), consentConfirmed: z.literal(true), ...fields }),
  z.strictObject({ deviceId: z.uuid(), ...fields }),
]);
const idempotency = z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/);

export async function GET(request: Request) {
  return withPilotAccess(request, true, async (tx, userId) => {
    await expireMessages(tx, new Date(), userId);
    const requestedId = new URL(request.url).searchParams.get("id");
    if (requestedId) {
      const id = z.uuid().parse(requestedId);
      const message = await tx.smsPilotMessage.findFirst({ where: { userId, id }, select: messageFields });
      return message ? apiSuccess({ message }) : apiError("Mensagem não encontrada", 404);
    }
    const messages = await tx.smsPilotMessage.findMany({
      where: { userId }, select: messageFields, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
    });
    return apiSuccess({ messages });
  });
}

export async function POST(request: Request) {
  return withPilotAccess(request, true, async (tx, userId, role) => {
    if (!realSendEnabled()) return apiError("Envio real pausado por operação", 503);
    const idempotencyKey = idempotency.parse(request.headers.get("idempotency-key"));
    const data = create.parse(await request.json());
    const gateway = "simId" in data;
    const fingerprint = gateway
      ? privateHash(["gateway-message-v1", userId, data.simId, data.destination, data.text])
      : privateHash(["message-v1", userId, data.deviceId, data.destination, data.text]);
    const previous = await tx.smsPilotMessage.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } }, select: { ...messageFields, fingerprint: true },
    });
    if (previous) {
      const { fingerprint: existing, ...message } = previous;
      return existing === fingerprint ? apiSuccess({ message }) : apiError("A chave já foi usada com outro pedido", 409);
    }
    const hash = destinationFingerprint(userId, data.destination);
    const now = new Date();
    let deviceId: string;
    let bindingId: string;
    if (gateway) {
      const sim = await tx.smsGatewaySim.findFirst({ where: {
        id: data.simId, device: { userId, revokedAt: null, gateway: true },
      }, include: { device: { select: { id: true, gatewayEnabled: true } } } });
      if (!sim) return apiError("Chip não encontrado nesta conta", 404);
      if (!sim.available || !sim.device.gatewayEnabled) return apiError("O gateway deste chip está pausado ou o SIM está indisponível", 409);
      deviceId = sim.device.id;
      bindingId = sim.id;
    } else {
      const device = await tx.smsPilotDevice.findFirst({ where: { id: data.deviceId, userId, revokedAt: null } });
      if (!device) return apiError("Aparelho não encontrado", 404);
      if (device.gateway) return apiError("Use o simId do chip para enviar pelo gateway deste aparelho", 409);
      if (!device.approvedBinding || !reviewedDestinations(device).some(item => item.hash === hash)) {
        return apiError("Este número precisa estar na lista de destinos aprovados do chip", 403);
      }
      if (device.consentVersion !== consentVersion) {
        return apiError("Abra a tela SMS Beta no Android e selecione o SIM aprovado para retomar o envio.", 409);
      }
      const count = await tx.smsPilotMessage.count({
        where: { userId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
      });
      if (count >= 5) return apiError("Limite de 5 solicitações em 24 horas no piloto", 429);
      deviceId = device.id;
      bindingId = device.approvedBinding;
    }
    if (!await registerConsentedContact(tx, userId, hash, data.destination, now)) {
      return apiError("Este número solicitou descadastro nesta conta", 403);
    }
    const message = await tx.smsPilotMessage.create({ data: {
      userId, deviceId, bindingId, idempotencyKey, fingerprint,
      maskedDestination: maskPhone(data.destination), destinationHash: hash,
      encryptedPayload: encrypt(JSON.stringify({ to: data.destination, text: data.text })),
      expiresAt: new Date(now.getTime() + (gateway ? 86_400_000 : 600_000)),
    }, select: messageFields });
    await tx.auditLog.create({ data: { actorId: userId, action: "sms_pilot.enqueue", targetId: message.id,
      metadata: { channel: role === "API_KEY" ? "api" : "web", deviceId, bindingId } } });
    return apiSuccess({ message }, 202);
  });
}

export async function PATCH(request: Request) {
  return withPilotAccess(request, true, async (tx, userId) => {
    const { id } = z.strictObject({ id: z.uuid(), action: z.literal("cancel") }).parse(await request.json());
    const current = await tx.smsPilotMessage.findFirst({ where: { id, userId }, select: messageFields });
    if (!current) return apiError("Mensagem não encontrada", 404);
    if (current.state === "CANCELED") return apiSuccess({ message: current });
    const changed = await tx.smsPilotMessage.updateMany({
      where: { id, userId, state: "QUEUED", expiresAt: { gt: new Date() } },
      data: { state: "CANCELED", encryptedPayload: null },
    });
    if (!changed.count) return apiError("A mensagem já saiu da fila", 409);
    await tx.auditLog.create({ data: { actorId: userId, action: "sms_pilot.cancel", targetId: id } });
    return apiSuccess({ message: await tx.smsPilotMessage.findUnique({ where: { id }, select: messageFields }) });
  });
}
