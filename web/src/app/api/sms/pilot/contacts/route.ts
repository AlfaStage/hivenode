import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { visibleNumber } from "@/lib/sms-gateway";
import { withPilotAccess } from "@/lib/sms-pilot";

export async function GET(request: Request) {
  return withPilotAccess(request, true, async (tx, userId) => {
    const params = new URL(request.url).searchParams;
    const simId = z.uuid().nullable().parse(params.get("simId"));
    const after = z.uuid().nullable().parse(params.get("after"));
    const optedOut = params.get("optedOut") === "true";
    if (!simId && !optedOut) return apiError("Informe o simId ou optedOut=true", 400);
    if (simId && !await tx.smsGatewaySim.findFirst({ where: { id: simId, device: { userId } }, select: { id: true } })) {
      return apiError("Chip não encontrado nesta conta", 404);
    }
    const records = await tx.smsGatewayContact.findMany({
      where: { userId, ...(after ? { id: { gt: after } } : {}), ...(optedOut ? { optedOutAt: { not: null } } : {}),
        ...(simId ? { activity: { some: { simId } } } : {}) },
      orderBy: { id: "asc" }, take: 51,
      select: { id: true, maskedNumber: true, encryptedNumber: true, optedOutAt: true, optOutKeyword: true,
        activity: { where: { simId: simId ?? "" }, select: { lastSentAt: true }, take: 1 } },
    });
    return apiSuccess({
      contacts: records.slice(0, 50).map(({ encryptedNumber, activity, ...contact }) => ({
        ...contact, phoneNumber: visibleNumber(encryptedNumber), lastSentAt: activity[0]?.lastSentAt ?? null,
      })),
      nextCursor: records.length > 50 ? records[49].id : null,
    });
  });
}
