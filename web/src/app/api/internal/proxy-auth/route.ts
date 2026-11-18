import { z } from "zod";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/broker";
import { bcryptCompare } from "@/lib/crypto";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { proxyAccess } from "@/lib/proxy-access";
import { rateLimit } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";
export async function POST(request: Request) {
  try {
    requireInternal(request);
    const body = z.object({ username: z.string().max(64), password: z.string().max(72) }).parse(await request.json());
    if (!await rateLimit("socks", body.username, 120, 60)) return apiError("Rate limited", 429);
    const credential = await prisma.proxyCredential.findUnique({ where: { proxyUser: body.username } });
    if (!credential) return apiError("Unauthorized", 401);
    // Cache only password verification, never authorization. The stored bcrypt hash
    // participates in the key so password rotation invalidates it immediately.
    // HMAC keeps a fast password digest out of Redis even if cache keys are exposed.
    const proof = createHmac("sha256", process.env.BROKER_INTERNAL_SECRET!)
      .update(JSON.stringify([credential.id, credential.proxyPass, body.password])).digest("hex");
    const key = `socks:verified:${proof}`;
    if (!await redis.get(key)) {
      if (!await bcryptCompare(body.password, credential.proxyPass)) return apiError("Unauthorized", 401);
      await redis.set(key, "1", "EX", 60);
    }
    const { proxy, metered } = await proxyAccess(prisma, credential.id);
    return apiSuccess({ proxyId: proxy.id, userId: proxy.userId, nodeId: proxy.nodeId, metered });
  } catch (error) { return handleApiError(error); }
}
