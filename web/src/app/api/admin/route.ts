import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({ select: {
      id: true, email: true, role: true, disabled: true, balanceGB: true, hivePoints: true,
      walletAddress: true, createdAt: true,
      nodes: { select: { id: true, userId: true, deviceModel: true, visibility: true, status: true, type: true, createdAt: true, proxies: { select: { id: true, userId: true, nodeId: true, proxyUser: true,
        status: true, totalBytesRx: true, totalBytesTx: true, createdAt: true } } } },
      subscriptions: true,
    }, orderBy: { createdAt: "desc" } });
    return apiSuccess({ users });
  } catch (error) { return handleApiError(error); }
}
