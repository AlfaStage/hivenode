import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessSmsBeta } from "@/lib/sms-beta-access";
import { isSmsBetaSameOrigin } from "@/lib/sms-beta-origin";

const createSchema = z.strictObject({
  destination: z.string().regex(/^\+[1-9]\d{7,14}$/),
  text: z.string().trim().min(1).max(480),
  scenario: z.enum(["DELIVERED", "SENT", "FAILED", "UNKNOWN"]),
});
const actionSchema = z.strictObject({ id: z.uuid(), action: z.enum(["simulate", "cancel"]) });
const keySchema = z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/);
const historyDays = 30;
const messageFields = { id: true, maskedDestination: true, scenario: true, state: true, createdAt: true } as const;

async function inSmsBeta(
  action: (tx: Prisma.TransactionClient, userId: string) => Promise<Response>,
) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return apiError("Faça login para continuar", 401);
    if (!canAccessSmsBeta(session)) return apiError("Não encontrado", 404);

    return await prisma.$transaction(async tx => {
      // Lock the same row the administrator updates so a concurrent revoke wins before later requests.
      const [user] = await tx.$queryRaw<Array<{
        role: string; smsBetaAccess: boolean; disabled: boolean; sessionVersion: number;
      }>>`SELECT "role", "smsBetaAccess", "disabled", "sessionVersion" FROM "users" WHERE "id" = ${session.userId} FOR UPDATE`;
      if (!user || user.disabled || user.sessionVersion !== session.version) return apiError("Faça login para continuar", 401);
      if (!canAccessSmsBeta({ ...user, scope: session.scope })) return apiError("Não encontrado", 404);
      return action(tx, session.userId);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function historyStart() {
  return new Date(Date.now() - historyDays * 86_400_000);
}

export async function GET() {
  return inSmsBeta(async (tx, userId) => {
    const messages = await tx.smsBetaMessage.findMany({ where: { userId, createdAt: { gte: historyStart() } },
      select: messageFields, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 });
    return apiSuccess({ messages });
  });
}

export async function POST(request: Request) {
  return inSmsBeta(async (tx, userId) => {
    if (!isSmsBetaSameOrigin(request)) return apiError("Origem não autorizada", 403);
    const idempotencyKey = keySchema.parse(request.headers.get("idempotency-key"));
    const { destination, text, scenario } = createSchema.parse(await request.json());
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret || secret.length < 32) throw new Error("ENCRYPTION_KEY não configurada");
    // The simulation needs neither recoverable message content nor complete destination numbers.
    const requestFingerprint = createHmac("sha256", secret)
      .update(JSON.stringify(["sms-beta-simulation-v1", userId, destination, text, scenario])).digest("hex");
    const previous = await tx.smsBetaMessage.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } },
      select: { ...messageFields, requestFingerprint: true } });
    if (previous) {
      const { requestFingerprint: fingerprint, ...message } = previous;
      if (fingerprint !== requestFingerprint) return apiError("Esta chave já foi usada com outro pedido", 409);
      return apiSuccess({ message });
    }

    const recent = await tx.smsBetaMessage.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 60_000) } } });
    if (recent >= 20) return apiError("Aguarde um minuto para criar mais testes", 429);
    const pending = await tx.smsBetaMessage.count({ where: { userId, state: "QUEUED", createdAt: { gte: historyStart() } } });
    if (pending >= 50) return apiError("Execute ou cancele testes pendentes antes de criar novos", 409);

    const message = await tx.smsBetaMessage.create({ data: { userId, idempotencyKey, requestFingerprint,
      maskedDestination: `•••• ${destination.slice(-4)}`, scenario }, select: messageFields });
    return apiSuccess({ message }, 202);
  });
}

export async function PATCH(request: Request) {
  return inSmsBeta(async (tx, userId) => {
    if (!isSmsBetaSameOrigin(request)) return apiError("Origem não autorizada", 403);
    const { id, action } = actionSchema.parse(await request.json());
    const message = await tx.smsBetaMessage.findFirst({ where: { id, userId, createdAt: { gte: historyStart() } }, select: messageFields });
    if (!message) return apiError("Não encontrado", 404);
    const state = action === "cancel" ? "CANCELED" : message.scenario;
    if (message.state === state) return apiSuccess({ message });
    if (message.state !== "QUEUED") return apiError("O teste já foi concluído", 409);
    const updated = await tx.smsBetaMessage.update({ where: { id }, data: { state }, select: messageFields });
    return apiSuccess({ message: updated });
  });
}
