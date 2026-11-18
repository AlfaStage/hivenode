import { requireAuth, generateQrLinkToken } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const miner = new URL(request.url).searchParams.get("type") === "miner";
    if (miner && !user.minerBetaAccess) return apiError("Não encontrado", 404);
    const token = await generateQrLinkToken(user.userId, miner);
    return apiSuccess({ linkToken: token, ip: process.env.NEXT_PUBLIC_BROKER_URL || "wss://api.hivenode.alfastage.com.br" });
  } catch (error) { return handleApiError(error); }
}
