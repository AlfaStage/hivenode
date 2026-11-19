import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasSmsBetaAccess } from "@/lib/sms-beta-access";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return apiError("Faça login para continuar", 401);
    if (!hasSmsBetaAccess(user.accountRole, user.smsBetaAccess)) return apiSuccess({ allowed: false });
    const device = await prisma.smsPilotDevice.findFirst({
      where: { userId: user.userId, revokedAt: null }, select: { id: true },
    });
    return apiSuccess({ allowed: true, userId: user.userId, pairedDeviceId: device?.id ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}
