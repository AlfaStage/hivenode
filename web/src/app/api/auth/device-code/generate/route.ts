import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import crypto from "crypto";
import { z } from "zod";


function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(crypto.randomInt(chars.length));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = z.object({ type: z.enum(["miner", "proxy", "node"]).default("miner") }).parse(body);

    const deviceCode = crypto.randomBytes(32).toString("hex");
    const userCode = generateShortCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min expiry
    const verificationUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/${type === "miner" ? "miner" : "proxies"}`;

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
      return apiError("Serviço de vínculo indisponível", 503);
    }

    return apiSuccess({
      deviceCode,
      userCode,
      verificationUri,
      expiresIn: 300
    });
  } catch (error) {
    return handleApiError(error);
  }
}
