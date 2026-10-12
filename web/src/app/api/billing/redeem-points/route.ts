import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { getSystemSettings } from "@/lib/settings";
import { serializable } from "@/lib/transactions";
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = z.object({ pointsToRedeem: z.number().finite().positive().max(1e12) }).safeParse(await request.json());
    if (!parsed.success) return apiError("Quantidade inválida", 400);
    const points = parsed.data.pointsToRedeem;
    const settings = await getSystemSettings();
    const gb = points / settings.crypto.pointsToHiveRate;
    if (gb < 0.01) return apiError("Conversão mínima: 0,01 GB", 400);
    const balance = await serializable(async tx => {
      const debit = await tx.user.updateMany({ where: { id: user.userId, hivePoints: { gte: points } },
        data: { hivePoints: { decrement: points }, balanceGB: { increment: gb } } });
      if (!debit.count) throw new Error("Forbidden");
      await tx.pointsLedger.create({ data: { userId: user.userId, amount: -points, type: "CLAIM" } });
      await tx.payment.create({ data: { userId: user.userId, type: "PAY_PER_USE", status: "PAID", amountCents: 0,
        metadata: { type: "points_redemption", pointsRedeemed: points, gbAdded: gb, rate: settings.crypto.pointsToHiveRate } } });
      return tx.user.findUniqueOrThrow({ where: { id: user.userId }, select: { balanceGB: true, hivePoints: true } });
    });
    return apiSuccess({ gbAdded: gb, pointsRedeemed: points, newBalance: { points: balance.hivePoints, gb: balance.balanceGB } });
  } catch (error) { return handleApiError(error); }
}
