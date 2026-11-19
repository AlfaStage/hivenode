import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { encrypt } from "@/lib/crypto";
import { consentVersion, destination, expireMessages, maskPhone, messageFields, privateHash, realSendEnabled, withPilotAccess } from "@/lib/sms-pilot";

const create = z.strictObject({ deviceId: z.uuid(), destination, text: z.string().trim().min(1).max(420) });
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
    const fingerprint = privateHash(["message-v1", userId, data.deviceId, data.destination, data.text]);
    const previous = await tx.smsPilotMessage.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } }, select: { ...messageFields, fingerprint: true },
    });
    if (previous) {
      const { fingerprint: existing, ...message } = previous;
      return existing === fingerprint ? apiSuccess({ message }) : apiError("A chave já foi usada com outro pedido", 409);
    }
    const device = await tx.smsPilotDevice.findFirst({ where: { id: data.deviceId, userId, revokedAt: null } });
    if (!device) return apiError("Aparelho não encontrado", 404);
    if (!device.approvedBinding || !device.approvedAt || device.consentVersion !== consentVersion ||
        device.destinationHash !== privateHash(["destination-v1", userId, data.destination])) {
      return apiError("A linha e este destino precisam estar aprovados para o piloto", 403);
    }
    const now = new Date();
    await expireMessages(tx, now, userId);
    const count = await tx.smsPilotMessage.count({
      where: { userId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
    });
    if (count >= 5) return apiError("Limite de 5 solicitações em 24 horas no piloto", 429);
    const message = await tx.smsPilotMessage.create({ data: {
      userId, deviceId: data.deviceId, bindingId: device.approvedBinding, idempotencyKey, fingerprint,
      maskedDestination: maskPhone(data.destination), encryptedPayload: encrypt(JSON.stringify({ to: data.destination, text: data.text })),
      expiresAt: new Date(now.getTime() + 600_000),
    }, select: messageFields });
    await tx.auditLog.create({ data: { actorId: userId, action: "sms_pilot.enqueue", targetId: message.id,
      metadata: { channel: role === "API_KEY" ? "api" : "web", deviceId: data.deviceId } } });
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
