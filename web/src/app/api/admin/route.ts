import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { requireAdmin } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({ select: {
      id: true, email: true, role: true, disabled: true, balanceGB: true, hivePoints: true,
      walletAddress: true, createdAt: true,
      nodes: { select: { id: true, userId: true, deviceModel: true, ipAddress: true, visibility: true, status: true, type: true, createdAt: true, proxies: { select: { id: true, userId: true, nodeId: true, proxyUser: true,
        status: true, totalBytesRx: true, totalBytesTx: true, createdAt: true } } } },
      subscriptions: true,
    }, orderBy: { createdAt: "desc" } });
    const nodes = users.flatMap(user => user.nodes);
    const online = nodes.length ? await redis.mget(...nodes.map(node => "node:online:" + node.id)) : [];
    const statuses = new Map(nodes.map((node, index) => [node.id, Boolean(online[index])]));
    return apiSuccess({ users: users.map(user => ({ ...user, nodes: user.nodes.map(node => ({
      ...node, status: node.status === "BLOCKED" ? "BLOCKED" : statuses.get(node.id) ? "ONLINE" : "OFFLINE",
    })) })) });
  } catch (error) { return handleApiError(error); }
}
