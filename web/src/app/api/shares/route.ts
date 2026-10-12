import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { brokerCommand } from "@/lib/broker";
export async function GET() {
  try {
    const user = await requireAuth();
    const account = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    return apiSuccess({ shares: await prisma.nodeShare.findMany({ where: { OR: [
      { ownerId: user.userId }, { sharedWithEmail: account.email },
    ] }, include: { node: { select: { deviceModel: true } } } }) });
  } catch (error) { return handleApiError(error); }
}
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = z.object({ nodeId: z.string().uuid(), email: z.email(), maxProxies: z.number().int().min(1).max(100).default(1) }).parse(await request.json());
    const node = await prisma.node.findUnique({ where: { id: body.nodeId } });
    if (!node || node.userId !== user.userId || node.visibility !== "PRIVATE") return apiError("Forbidden", 403);
    const email = body.email.toLowerCase().trim();
    const share = await prisma.nodeShare.upsert({ where: { nodeId_sharedWithEmail: { nodeId: node.id, sharedWithEmail: email } },
      create: { nodeId: node.id, ownerId: user.userId, sharedWithEmail: email, maxProxies: body.maxProxies },
      update: { status: "PENDING", maxProxies: body.maxProxies } });
    return apiSuccess({ share });
  } catch (error) { return handleApiError(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await requireAuth();
    const body = z.object({ id: z.string().uuid(), action: z.enum(["accept", "revoke"]) }).parse(await request.json());
    const share = await prisma.nodeShare.findUnique({ where: { id: body.id } });
    if (!share) return apiError("Not found", 404);
    if (body.action === "accept") {
      const account = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
      if (share.sharedWithEmail !== account.email || share.status !== "PENDING") return apiError("Forbidden", 403);
      await prisma.nodeShare.update({ where: { id: share.id }, data: { status: "ACCEPTED", sharedWithId: user.userId } });
    } else {
      if (share.ownerId !== user.userId) return apiError("Forbidden", 403);
      await prisma.nodeShare.update({ where: { id: share.id }, data: { status: "REVOKED" } });
      const proxies = await prisma.proxyCredential.findMany({ where: { nodeId: share.nodeId, userId: share.sharedWithId || "" } });
      for (const proxy of proxies) await brokerCommand("/internal/revoke", { proxyId: proxy.id }).catch(console.error);
    }
    return apiSuccess({ updated: true });
  } catch (error) { return handleApiError(error); }
}
