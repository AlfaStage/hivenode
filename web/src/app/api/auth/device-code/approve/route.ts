import { z } from "zod";
import { requireAuth, generateQrLinkToken } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import { deviceSessionSchema } from "@/lib/device-code";
const approve = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local session = cjson.decode(raw)
if session.status ~= 'pending' then return -1 end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ttl)
return 1
`;
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { userCode } = z.object({ userCode: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/) }).parse(await request.json());
    const deviceCode = await redis.get("device_auth:user:" + userCode);
    if (!deviceCode) return apiError("Código inválido ou expirado", 404);
    const key = "device_auth:device:" + deviceCode;
    const raw = await redis.get(key);
    if (!raw) return apiError("Sessão de vínculo expirada", 404);
    const session = deviceSessionSchema.parse(JSON.parse(raw));
    if (session.status !== "pending") return apiError("Código já aprovado", 409);
    if (session.expiresAt <= Date.now()) return apiError("Código expirado", 404);
    const linkToken = await generateQrLinkToken(user.userId);
    const result = await redis.eval(approve, 1, key, JSON.stringify({ ...session, status: "approved", linkToken }));
    if (result !== 1) return apiError(result === -1 ? "Código já aprovado" : "Código expirado", result === -1 ? 409 : 404);
    return apiSuccess({ message: "Código aprovado. Aguardando o aparelho concluir o vínculo." });
  } catch (error) { return handleApiError(error); }
}
