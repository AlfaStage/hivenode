import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/broker";
import { bcryptCompare } from "@/lib/crypto";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { proxyAccess } from "@/lib/proxy-access";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  try {
    requireInternal(request);
    const body = z.object({ username: z.string().max(64), password: z.string().max(72) }).parse(await request.json());
    if (!await rateLimit("socks", body.username, 120, 60)) return apiError("Rate limited", 429);
    const credential = await prisma.proxyCredential.findUnique({ where: { proxyUser: body.username } });
    if (!credential || !await bcryptCompare(body.password, credential.proxyPass)) return apiError("Unauthorized", 401);
    const { proxy, metered } = await proxyAccess(prisma, credential.id);
    return apiSuccess({ proxyId: proxy.id, userId: proxy.userId, nodeId: proxy.nodeId, metered });
  } catch (error) { return handleApiError(error); }
}
