import type { Prisma, Plan } from "@prisma/client";
type JsonValue<T> = T extends Date ? string : T extends bigint ? string : T extends (infer U)[] ? JsonValue<U>[] : T extends object ? { [K in keyof T]: JsonValue<T[K]> } : T;
export type AdminUser = JsonValue<Prisma.UserGetPayload<{ select: {
  id: true; email: true; role: true; disabled: true; balanceGB: true; hivePoints: true; walletAddress: true; createdAt: true;
  nodes: { select: { id: true; userId: true; deviceModel: true; ipAddress: true; visibility: true; status: true; type: true; createdAt: true;
    proxies: { select: { id: true; userId: true; nodeId: true; proxyUser: true; status: true; totalBytesRx: true; totalBytesTx: true; createdAt: true } } } };
  subscriptions: true;
} }>>;
export type AdminPlan = JsonValue<Plan>;
