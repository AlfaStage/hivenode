import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import { encrypt, decrypt } from "@/lib/crypto";
import { serializable } from "@/lib/transactions";

const schema = z.object({ deviceName: z.string().trim().min(1).max(100),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  installationId: z.string().min(8).max(128).optional() });

export async function GET() {
  try {
    const user = await requireAuth();
    const nodes = await prisma.node.findMany({ where: { userId: user.userId }, orderBy: { createdAt: "desc" } });
    const online = nodes.length ? await redis.mget(...nodes.map(n => `node:online:${n.id}`)) : [];
    return apiSuccess({ nodes: nodes.map(({ tunnelSecret: _secret, ...n }, index) => ({ ...n,
      deviceName: n.deviceModel, status: n.status === "BLOCKED" ? "BLOCKED" : online[index] ? "ONLINE" : "OFFLINE",
    })) });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Dados do aparelho inválidos", 400);
    const input = parsed.data;
    const node = await serializable(async tx => {
      if (input.installationId) {
        const existing = await tx.node.findUnique({ where: { userId_installationId: {
          userId: user.userId, installationId: input.installationId,
        } } });
        if (existing) {
          if (existing.status === "BLOCKED") throw new Error("Forbidden");
          return existing;
        }
      }
      // Supplying public capacity is free; paid private-fleet limits apply only to private devices.
      if (input.visibility === "PRIVATE" && user.role !== "ADMIN") {
        const subs = await tx.subscription.findMany({ where: { userId: user.userId, status: "ACTIVE",
          currentPeriodEnd: { gt: new Date() }, plan: { category: "PRIVATE_FLEET" } }, include: { plan: true } });
        const plans = subs.flatMap(s => s.plan ? [s.plan] : []);
        const count = await tx.node.count({ where: { userId: user.userId, visibility: "PRIVATE" } });
        if (!plans.length || (!plans.some(p => p.maxDevices === 0) && count >= plans.reduce((n, p) => n + p.maxDevices, 0))) {
          throw new Error("Forbidden");
        }
      }
      return tx.node.create({ data: { userId: user.userId, deviceModel: input.deviceName,
        visibility: input.visibility, installationId: input.installationId, type: "BYOD",
        tunnelSecret: encrypt(randomBytes(32).toString("hex")) } });
    });
    const { tunnelSecret: encrypted, ...safeNode } = node;
    return apiSuccess({ node: safeNode, tunnelSecret: encrypted ? decrypt(encrypted) : null,
      brokerHost: process.env.NEXT_PUBLIC_BROKER_URL || "ws://localhost:10001", protocolVersion: 1 });
  } catch (error) { return handleApiError(error); }
}
