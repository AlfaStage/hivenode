import { NextRequest } from "next/server";
import { verifyOneTimeToken, generateToken } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { linkToken } = await request.json();
    if (!linkToken) return apiError("Token ausente", 400);

    const payload = await verifyOneTimeToken(linkToken, "qr_link");

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.disabled) return apiError("Usuário não encontrado", 404);
    const consumed = await prisma.oneTimeToken.deleteMany({ where: {
      id: payload.id, userId: user.id, type: "qr_link", expiresAt: { gt: new Date() },
    } });
    if (consumed.count !== 1) return apiError("Código já utilizado ou expirado", 401);

    const token = await generateToken(user.id, "CUSTOMER", undefined, user.sessionVersion, "device");
    return apiSuccess({ token, user: { id: user.id, email: user.email, role: "CUSTOMER", tunnelSecret: user.tunnelSecret } });
  } catch {
    return apiError("Token expirado ou inválido", 401);
  }
}
