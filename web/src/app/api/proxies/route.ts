import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { bcryptHash, encrypt, decrypt } from "@/lib/crypto";
import { serializable } from "@/lib/transactions";

const schema = z.object({ proxyUser: z.string().regex(/^[a-zA-Z0-9_-]{3,64}$/),
  proxyPass: z.string().min(12).max(72), nodeId: z.string().uuid() });
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Usuário inválido ou senha com menos de 12 caracteres", 400);
    const input = parsed.data;
    const hash = await bcryptHash(input.proxyPass);
    const proxy = await serializable(async tx => {
      const node = await tx.node.findUnique({ where: { id: input.nodeId } });
      if (!node || node.status === "BLOCKED") throw new Error("Forbidden");
      const share = await tx.nodeShare.findFirst({ where: { nodeId: node.id, sharedWithId: user.userId, status: "ACCEPTED" } });
      if (node.userId !== user.userId && node.visibility !== "PUBLIC" && !share) throw new Error("Forbidden");
      if (share && await tx.proxyCredential.count({ where: { nodeId: node.id, userId: user.userId } }) >= share.maxProxies) throw new Error("Forbidden");
      if (user.role !== "ADMIN" && node.visibility === "PRIVATE" && !share) {
        const subs = await tx.subscription.findMany({ where: { userId: user.userId, status: "ACTIVE",
          currentPeriodEnd: { gt: new Date() }, plan: { category: "PRIVATE_FLEET" } }, include: { plan: true } });
        const plans = subs.flatMap(s => s.plan ? [s.plan] : []);
        const count = await tx.proxyCredential.count({ where: { userId: user.userId, node: { visibility: "PRIVATE" } } });
        if (!plans.length || (!plans.some(p => p.maxProxies === 0) && count >= plans.reduce((n, p) => n + p.maxProxies, 0))) throw new Error("Forbidden");
      }
      return tx.proxyCredential.create({ data: { userId: user.userId, nodeId: node.id,
        proxyUser: input.proxyUser, proxyPass: hash, passwordEncrypted: encrypt(input.proxyPass) } });
    });
    return apiSuccess({ proxy: { ...proxy, proxyPass: input.proxyPass, passwordEncrypted: undefined } }, 201);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return apiError("Usuário proxy já existe", 409);
    return handleApiError(error);
  }
}
export async function GET() {
  try {
    const user = await requireAuth();
    const proxies = await prisma.proxyCredential.findMany({ where: { userId: user.userId },
      include: { node: { select: { id: true, deviceModel: true, visibility: true, status: true } } }, orderBy: { createdAt: "desc" } });
    return apiSuccess({ proxies: proxies.map(({ passwordEncrypted, ...p }) => ({ ...p,
      proxyPass: passwordEncrypted ? decrypt(passwordEncrypted) : "", needsRotation: !passwordEncrypted,
    })), host: process.env.NEXT_PUBLIC_SOCKS_HOST || "localhost", port: Number(process.env.BROKER_SOCKS_PORT || 10000) });
  } catch (error) { return handleApiError(error); }
}
