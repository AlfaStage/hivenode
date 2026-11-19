import { createHash, createHmac, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError, handleApiError } from "@/lib/api-utils";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSmsBetaSameOrigin } from "@/lib/sms-beta-origin";

export const consentVersion = "pilot-br-1";
export const bindingId = z.uuid();
export const destination = z.string().trim().regex(/^\+55[1-9]\d{9,10}$/);
export const bindingList = z.array(z.strictObject({
  id: bindingId,
  slot: z.number().int().min(0).max(8),
  label: z.string().trim().min(1).max(48),
})).max(8).refine(items => new Set(items.map(item => item.id)).size === items.length);
export const messageFields = {
  id: true, deviceId: true, maskedDestination: true, state: true, createdAt: true,
  updatedAt: true, errorCode: true, sentParts: true, deliveredParts: true,
  failedParts: true, totalParts: true,
} as const;

export function realSendEnabled() {
  return process.env.SMS_REAL_SEND_ENABLED === "true" && Boolean(process.env.SMS_PILOT_LOOKUP_KEY?.match(/^[a-f0-9]{64}$/i));
}

export function opaqueToken(prefix: string) {
  return prefix + randomBytes(32).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function privateHash(value: unknown) {
  const secret = process.env.SMS_PILOT_LOOKUP_KEY;
  if (!secret?.match(/^[a-f0-9]{64}$/i)) throw new Error("Missing SMS pilot lookup key");
  return createHmac("sha256", Buffer.from(secret, "hex")).update(JSON.stringify(value)).digest("hex");
}

export function signGrant(agentToken: string, payload: string) {
  return createHmac("sha256", agentToken).update("hivenode-sms-grant-v1." + payload).digest("hex");
}

export function maskPhone(number: string) {
  return "+55 •••• " + number.slice(-4);
}

type Owner = { role: string; disabled: boolean; sessionVersion: number; smsBetaAccess: boolean };
export async function lockOwner(tx: Prisma.TransactionClient, id: string) {
  const [owner] = await tx.$queryRaw<Owner[]>`SELECT "role", "disabled", "sessionVersion", "smsBetaAccess"
    FROM "users" WHERE "id" = ${id} FOR UPDATE`;
  return owner;
}

export function isAdmitted(owner: Owner | undefined) {
  return Boolean(owner && !owner.disabled && (owner.role === "ADMIN" || owner.smsBetaAccess));
}

export async function withPilotAccess(
  request: Request, allowedKey: boolean, action: (tx: Prisma.TransactionClient, id: string, role: string) => Promise<Response>,
) {
  try {
    const authorization = request.headers.get("authorization");
    if (allowedKey && authorization?.match(/^Bearer smsk_[a-f0-9]{64}$/)) {
      const tokenHash = hashToken(authorization.slice(7));
      return await prisma.$transaction(async tx => {
        const key = await tx.smsPilotKey.findUnique({ where: { tokenHash } });
        if (!key || key.revokedAt) return apiError("Credencial inválida", 401);
        const owner = await lockOwner(tx, key.userId);
        const current = await tx.smsPilotKey.findUnique({ where: { id: key.id }, select: { revokedAt: true } });
        if (!isAdmitted(owner) || !current || current.revokedAt) return apiError("Credencial inválida", 401);
        return action(tx, key.userId, "API_KEY");
      });
    }
    const session = await getAuthenticatedUser();
    if (!session) return apiError("Faça login para continuar", 401);
    if (session.scope !== "web") return apiError("Não encontrado", 404);
    if (request.method !== "GET" && !isSmsBetaSameOrigin(request)) return apiError("Origem não autorizada", 403);
    return await prisma.$transaction(async tx => {
      const owner = await lockOwner(tx, session.userId);
      if (!owner || owner.disabled || owner.sessionVersion !== session.version) return apiError("Faça login para continuar", 401);
      if (!isAdmitted(owner)) return apiError("Não encontrado", 404);
      return action(tx, session.userId, owner.role);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function expireMessages(tx: Pick<Prisma.TransactionClient, "smsPilotMessage">, now: Date, userId?: string) {
  await tx.smsPilotMessage.updateMany({
    where: { userId, state: "QUEUED", expiresAt: { lte: now } },
    data: { state: "EXPIRED", encryptedPayload: null, errorCode: "QUEUE_EXPIRED" },
  });
  await tx.smsPilotMessage.updateMany({
    where: { userId, state: "AUTHORIZED", grantExpiresAt: { lte: new Date(now.getTime() - 120_000) } },
    data: { state: "UNKNOWN", errorCode: "CALLBACK_TIMEOUT" },
  });
}

export async function cancelPending(tx: Prisma.TransactionClient, ownerId: string, deviceId?: string) {
  await tx.smsPilotMessage.updateMany({
    where: { userId: ownerId, deviceId, state: "QUEUED" },
    data: { state: "CANCELED", encryptedPayload: null },
  });
}
