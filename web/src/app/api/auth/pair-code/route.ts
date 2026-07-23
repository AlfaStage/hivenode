import { NextRequest } from "next/server";
import { requireAuth, generateQrLinkToken, verifyToken } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import crypto from "crypto";

// Memory cache fallback if Redis is unavailable
const codeStore = new Map<string, { userId: string; expiresAt: number }>();

function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "HV-";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// GET: Gerar código curto de 6 caracteres (validez de 10 min)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const code = generateShortCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    try {
      await redis.set(`pair_code:${code}`, user.userId, "EX", 600);
    } catch {
      codeStore.set(code, { userId: user.userId, expiresAt });
    }

    const token = await generateQrLinkToken(user.userId);

    return apiSuccess({
      pairCode: code,
      token,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  } catch (error) {
    return apiError("Não autorizado", 401);
  }
}

// POST: Validar código curto e vincular dispositivo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pairCode } = body;

    if (!pairCode) {
      return apiError("Código de vínculo é obrigatório", 400);
    }

    const cleanCode = pairCode.trim().toUpperCase();
    let userId: string | null = null;

    try {
      userId = await redis.get(`pair_code:${cleanCode}`);
    } catch {
      const entry = codeStore.get(cleanCode);
      if (entry && entry.expiresAt > Date.now()) {
        userId = entry.userId;
      }
    }

    if (!userId) {
      return apiError("Código de vínculo inválido ou expirado", 404);
    }

    const linkToken = await generateQrLinkToken(userId);
    return apiSuccess({ userId, linkToken });
  } catch (error) {
    return apiError("Erro ao validar código de vínculo", 500);
  }
}
