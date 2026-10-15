import { z } from "zod";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import { deviceSessionSchema } from "@/lib/device-code";
const consume = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local session = cjson.decode(raw)
if session.status == 'approved' and session.linkToken then
  redis.call('DEL', KEYS[1])
  redis.call('DEL', 'device_auth:user:' .. session.userCode)
end
return raw
`;
export async function POST(request: Request) {
  try {
    const { deviceCode } = z.object({ deviceCode: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await request.json());
    let raw;
    try { raw = await redis.eval(consume, 1, "device_auth:device:" + deviceCode); }
    catch { return apiError("Serviço de vínculo indisponível", 503); }
    if (typeof raw !== "string") return apiError("Sessão expirada ou não encontrada", 404);
    const session = deviceSessionSchema.parse(JSON.parse(raw));
    if (session.expiresAt <= Date.now()) return apiError("Sessão expirada", 404);
    return apiSuccess(session.status === "approved" && session.linkToken
      ? { status: "success", token: session.linkToken } : { status: "pending" });
  } catch (error) { return handleApiError(error); }
}
