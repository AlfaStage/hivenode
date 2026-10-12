import type { Prisma } from "@prisma/client";

export async function proxyAccess(tx: Prisma.TransactionClient, proxyId: string) {
  const proxy = await tx.proxyCredential.findUnique({ where: { id: proxyId }, include: { user: true, node: { include: { user: true } } } });
  if (!proxy || proxy.status === "BLOCKED" || proxy.node.status === "BLOCKED" || proxy.user.disabled ||
      !proxy.node.user || proxy.node.user.disabled) throw new Error("Forbidden");
  const metered = proxy.node.visibility === "PUBLIC";
  if (metered) {
    if (proxy.user.balanceGB <= 0) throw new Error("Forbidden");
  } else {
    if (proxy.node.userId !== proxy.userId) {
      const share = await tx.nodeShare.findFirst({ where: { nodeId: proxy.nodeId, sharedWithId: proxy.userId, status: "ACCEPTED" } });
      if (!share) throw new Error("Forbidden");
    }
    if (proxy.node.user.role !== "ADMIN") {
      const subscription = await tx.subscription.findFirst({ where: { userId: proxy.node.userId!, status: "ACTIVE",
        currentPeriodEnd: { gt: new Date() }, plan: { category: "PRIVATE_FLEET" } } });
      if (!subscription) throw new Error("Forbidden");
    }
  }
  return { proxy, metered };
}
