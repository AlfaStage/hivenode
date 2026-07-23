import { NextRequest } from "next/server";
import { requireAuth, generateQrLinkToken } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { userCode } = body;

    if (!userCode) return apiError("Código do usuário é obrigatório", 400);

    const cleanCode = userCode.trim().toUpperCase();

    let deviceCode: string | null = null;
    try {
      deviceCode = await redis.get(`device_auth:user:${cleanCode}`);
    } catch {
      // Redis is required for cross-request state in production.
    }

    if (!deviceCode) {
      return apiError("Código inválido ou expirado", 404);
    }

    let sessionDataStr: string | null = null;
    try {
      sessionDataStr = await redis.get(`device_auth:device:${deviceCode}`);
    } catch {}

    if (!sessionDataStr) {
      return apiError("Sessão de vínculo expirada", 404);
    }

    const sessionData = JSON.parse(sessionDataStr);
    
    // Generate standard auth linkToken for the device
    const linkToken = await generateQrLinkToken(user.userId);

    sessionData.status = "approved";
    sessionData.linkToken = linkToken;

    try {
      // Update session for the polling device to pick up
      await redis.set(`device_auth:device:${deviceCode}`, JSON.stringify(sessionData), "EX", 300);
    } catch {}

    return apiSuccess({ message: "Aparelho vinculado com sucesso" });
  } catch (error: any) {
    if (error.message === "Unauthorized") return apiError("Não autorizado", 401);
    return apiError("Erro ao aprovar código", 500);
  }
}
