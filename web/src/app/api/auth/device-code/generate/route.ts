import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import crypto from "crypto";

// Fallback in-memory store if Redis is unavailable
const codeStore = new Map<string, { deviceCode: string; userCode: string; expiresAt: number; status: string; linkToken: string | null }>();

function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = body.type || "miner"; // miner or proxy

    const deviceCode = crypto.randomBytes(32).toString("hex");
    const userCode = generateShortCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min expiry
    const verificationUri = `https://${request.headers.get("host") || "hivenode.alfastage.com.br"}/dashboard/admin/device-approve`;

    const sessionData = {
      deviceCode,
      userCode,
      expiresAt,
      status: "pending",
      linkToken: null
    };

    try {
      await redis.set(`device_auth:device:${deviceCode}`, JSON.stringify(sessionData), "EX", 300);
      await redis.set(`device_auth:user:${userCode}`, deviceCode, "EX", 300);
    } catch {
      codeStore.set(deviceCode, sessionData);
      codeStore.set(userCode, sessionData as any); // hacky map for memory fallback
    }

    return apiSuccess({
      deviceCode,
      userCode,
      verificationUri,
      expiresIn: 300
    });
  } catch (error) {
    return apiError("Erro ao gerar código do dispositivo", 500);
  }
}
