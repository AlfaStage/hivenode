import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
export async function GET() {
  try {
    const user = await requireAuth();
    const nodes = await prisma.node.findMany({ where: { status: { not: "BLOCKED" }, OR: [
      { userId: user.userId }, { visibility: "PUBLIC", user: { disabled: false } },
      { shares: { some: { sharedWithId: user.userId, status: "ACCEPTED" } } },
    ] }, select: { id: true, deviceModel: true, visibility: true, status: true }, take: 200 });
    return apiSuccess({ nodes });
  } catch (error) { return handleApiError(error); }
}
