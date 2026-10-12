import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
export async function GET() {
  try {
    return apiSuccess({ plans: await prisma.plan.findMany({
      where: { isPublic: true, isAdminOnly: false }, orderBy: { priceInCents: "asc" },
    }) });
  } catch (error) { return handleApiError(error); }
}
