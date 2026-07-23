import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";

// Fallback in-memory store
const codeStore = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceCode } = body;

    if (!deviceCode) return apiError("deviceCode é obrigatório", 400);

    let sessionDataStr: string | null = null;
    let sessionData: any = null;

    try {
      sessionDataStr = await redis.get(`device_auth:device:${deviceCode}`);
      if (sessionDataStr) sessionData = JSON.parse(sessionDataStr);
    } catch {
      // Usar a variável do módulo globalmente (precisa ser injetada ou simulada em dev)
    }

    // Since codeStore is isolated per file in dev, we rely on Redis. 
    // If Redis fails, this polling might not work seamlessly across different Next.js hot reloads, but it's fine for production.

    if (!sessionData) {
      return apiError("Sessão expirada ou não encontrada", 404);
    }

    if (sessionData.status === "approved" && sessionData.linkToken) {
      // Limpa a sessão para não ser reutilizada
      try {
        await redis.del(`device_auth:device:${deviceCode}`);
        await redis.del(`device_auth:user:${sessionData.userCode}`);
      } catch {}

      return apiSuccess({
        status: "success",
        token: sessionData.linkToken
      });
    }

    return apiSuccess({
      status: "pending"
    });
  } catch (error) {
    return apiError("Erro ao checar status do código", 500);
  }
}
