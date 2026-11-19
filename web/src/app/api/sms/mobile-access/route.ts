import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasSmsBetaAccess } from "@/lib/sms-beta-access";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return apiError("Faça login para continuar", 401);
    if (!hasSmsBetaAccess(user.accountRole, user.smsBetaAccess)) return apiSuccess({ allowed: false });
    const devices = await prisma.smsPilotDevice.findMany({
      where: { userId: user.userId, revokedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true },
    });
    return apiSuccess({ allowed: true, userId: user.userId, pairedDeviceId: devices[0]?.id ?? null,
      pairedDeviceIds: devices.map(device => device.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
