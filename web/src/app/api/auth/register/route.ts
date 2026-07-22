// ==============================================================================
// API Route: POST /api/auth/register
// ==============================================================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateToken, setAuthCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validations/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validação com Zod
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return apiError(firstError.message, 400);
    }

    const { email, password } = parsed.data;

    // Verificar se e-mail já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return apiError("Este e-mail já está cadastrado", 409);
    }

    // Auto-promover para ADMIN se for domínio alfastage.com.br
    const isAlfastageAdmin = email.toLowerCase().trim().endsWith("@alfastage.com.br");
    const role = isAlfastageAdmin ? "ADMIN" : "CUSTOMER";
    const balanceGB = isAlfastageAdmin ? 999999 : 0;

    // Criar o usuário
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        balanceGB,
      },
      select: {
        id: true,
        email: true,
        role: true,
        balanceGB: true,
        createdAt: true,
      },
    });

    // Gerar JWT e setar cookie
    const token = await generateToken(user.id, user.role);
    await setAuthCookie(token);

    // Disparar e-mail de boas vindas
    sendWelcomeEmail(user.email, user.role).catch(console.error);

    return apiSuccess({
      user,
      token,
    }, 201);
  } catch (error) {
    console.error("[API] Register error:", error);
    return apiError("Erro interno do servidor", 500);
  }
}
