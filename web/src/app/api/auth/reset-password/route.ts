// ==============================================================================
// API Route: POST /api/auth/reset-password
// ==============================================================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPasswordResetToken, hashPassword } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token) {
      return apiError("Token de redefinição não informado", 400);
    }

    if (!password || password.length < 8) {
      return apiError("A nova senha deve ter no mínimo 8 caracteres", 400);
    }

    const payload = await verifyPasswordResetToken(token);
    if (!payload || !payload.userId) {
      return apiError("Link de redefinição de senha inválido ou expirado", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return apiError("Usuário não encontrado", 404);
    }

    const newPasswordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    return apiSuccess({
      message: "Senha alterada com sucesso! Você já pode fazer login.",
    });
  } catch (error) {
    console.error("[API] Reset Password Error:", error);
    return apiError("Erro ao redefinir a senha", 500);
  }
}
