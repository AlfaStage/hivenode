import { randomBytes } from "node:crypto";
import { requireAuth, generateQrLinkToken } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import { rateLimit } from "@/lib/rate-limit";
export async function GET() {
  try {
    const user = await requireAuth();
    const code = `HV-${randomBytes(6).toString("hex").toUpperCase()}`;
    await redis.set(`pair_code:${code}`, user.userId, "EX", 300, "NX");
    return apiSuccess({ pairCode: code, expiresAt: new Date(Date.now() + 300000).toISOString() });
  } catch (error) { return handleApiError(error); }
}
export async function POST(request: Request) {
  try {
    const { pairCode } = await request.json();
    if (typeof pairCode !== "string" || !/^HV-[A-F0-9]{12}$/i.test(pairCode)) return apiError("Código inválido", 400);
    if (!await rateLimit("pair", "global", 100, 60)) return apiError("Tente novamente", 429);
    const id = await redis.getdel(`pair_code:${pairCode.toUpperCase()}`);
    if (!id) return apiError("Código inválido ou expirado", 404);
    return apiSuccess({ linkToken: await generateQrLinkToken(id) });
  } catch (error) { return handleApiError(error); }
}
