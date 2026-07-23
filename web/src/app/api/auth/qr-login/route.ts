import { NextRequest } from "next/server";
import { verifyToken, generateToken } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { linkToken } = await request.json();
    if (!linkToken) return apiError("Token ausente", 400);

    const payload = await verifyToken(linkToken);
    if (payload.type !== "qr_link") return apiError("Token inválido para login QR", 400);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return apiError("Usuário não encontrado", 404);

    const token = await generateToken(user.id, user.role, user.tunnelSecret);
    return apiSuccess({ token, user: { id: user.id, email: user.email, tunnelSecret: user.tunnelSecret } });
  } catch {
    return apiError("Token expirado ou inválido", 401);
  }
}
