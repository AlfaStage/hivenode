import { randomBytes } from "node:crypto";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
export async function POST() {
  try {
    const user = await requireAuth();
    const ticket = randomBytes(32).toString("hex");
    await redis.set(`dashboard:ticket:${ticket}`, JSON.stringify({ userId: user.userId, role: user.role }), "EX", 30);
    return apiSuccess({ ticket, url: process.env.NEXT_PUBLIC_BROKER_URL || "ws://localhost:10001" });
  } catch (error) { return handleApiError(error); }
}
