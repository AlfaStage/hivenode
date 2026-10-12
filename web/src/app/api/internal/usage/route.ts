import { z } from "zod";
import { requireInternal } from "@/lib/broker";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { serializable } from "@/lib/transactions";
import { proxyAccess } from "@/lib/proxy-access";
const schema = z.object({ id: z.string().uuid(), proxyId: z.string().uuid(), nodeId: z.string().uuid(),
  bytesRx: z.number().int().min(0).max(1048576), bytesTx: z.number().int().min(0).max(1048576) });
export async function POST(request: Request) {
  try {
    requireInternal(request);
    const event = schema.parse(await request.json());
    await serializable(async tx => {
      if (await tx.usageEvent.findUnique({ where: { id: event.id } })) return;
      const { proxy, metered } = await proxyAccess(tx, event.proxyId);
      if (proxy.nodeId !== event.nodeId) throw new Error("Forbidden");
      const gb = (event.bytesRx + event.bytesTx) / 1073741824;
      if (metered) {
        const debit = await tx.user.updateMany({ where: { id: proxy.userId, balanceGB: { gte: gb } },
          data: { balanceGB: { decrement: gb } } });
        if (!debit.count) throw new Error("Forbidden");
        if (proxy.node.userId !== proxy.userId) {
          const points = gb * 100;
          await tx.user.update({ where: { id: proxy.node.userId! }, data: { hivePoints: { increment: points } } });
          await tx.pointsLedger.create({ data: { userId: proxy.node.userId!, amount: points, type: "TRAFFIC" } });
        }
      }
      await tx.proxyCredential.update({ where: { id: proxy.id }, data: {
        totalBytesRx: { increment: event.bytesRx }, totalBytesTx: { increment: event.bytesTx },
      } });
      await tx.usageEvent.create({ data: { ...event, userId: proxy.userId, chargedGB: metered ? gb : 0 } });
    });
    return apiSuccess({ recorded: true });
  } catch (error) { return handleApiError(error); }
}
