// ==============================================================================
// API Route: POST /api/auth/login
// ==============================================================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateToken, setAuthCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/auth";
import { apiError, apiSuccess } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validação com Zod
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return apiError(firstError.message, 400);
    }

    const { email, password } = parsed.data;

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        balanceGB: true,
        createdAt: true,
      },
    });

    if (!user) {
      return apiError("E-mail ou senha incorretos", 401);
    }

    // Verificar senha
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return apiError("E-mail ou senha incorretos", 401);
    }

    // Gerar JWT e setar cookie
    const token = await generateToken(user.id, user.role);
    await setAuthCookie(token);

    // Remover passwordHash do retorno
    const { passwordHash: removedHash, ...userWithoutPassword } = user;

    return apiSuccess({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error("[API] Login error:", error);
    return apiError("Erro interno do servidor", 500);
  }
}
