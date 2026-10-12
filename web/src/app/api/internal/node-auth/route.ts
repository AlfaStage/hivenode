import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/broker";
import { decrypt } from "@/lib/crypto";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
const schema = z.object({ nodeId: z.string().uuid(), sig: z.string().regex(/^[a-f0-9]{64}$/), timestamp: z.coerce.number().int() });
export async function POST(request: Request) {
  try {
    requireInternal(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid handshake", 400);
    const { nodeId, sig, timestamp } = parsed.data;
    if (Math.abs(Date.now() / 1000 - timestamp) > 90) return apiError("Expired handshake", 401);
    const node = await prisma.node.findUnique({ where: { id: nodeId }, include: { user: true } });
    if (!node?.user || node.user.disabled || node.status === "BLOCKED" || !node.tunnelSecret) return apiError("Forbidden", 403);
    const expected = createHmac("sha256", decrypt(node.tunnelSecret)).update(`${nodeId}:${timestamp}`).digest("hex");
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return apiError("Unauthorized", 401);
    if (!await redis.set(`handshake:${sig}`, "1", "EX", 180, "NX")) return apiError("Handshake reused", 401);
    return apiSuccess({ nodeId, userId: node.userId, visibility: node.visibility });
  } catch (error) { return handleApiError(error); }
}
