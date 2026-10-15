import { requireAuth, generateQrLinkToken } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
export async function GET() {
  try {
    const user = await requireAuth();
    const token = await generateQrLinkToken(user.userId);
    return apiSuccess({ linkToken: token, ip: process.env.NEXT_PUBLIC_BROKER_URL || "wss://api.hivenode.alfastage.com.br" });
  } catch (error) { return handleApiError(error); }
}
