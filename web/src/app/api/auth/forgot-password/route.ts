// ==============================================================================
// API Route: POST /api/auth/forgot-password
// ==============================================================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePasswordResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { apiSuccess, apiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email?.toLowerCase()?.trim();

    if (!email) {
      return apiError("Informe o e-mail cadastrado", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const resetToken = await generatePasswordResetToken(user.id);
      const origin = process.env.NEXT_PUBLIC_APP_URL;
      if (!origin) throw new Error("NEXT_PUBLIC_APP_URL is required");
      const resetUrl = `${origin}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    return apiSuccess({
      message: "Se o e-mail estiver cadastrado, um link de redefinição de senha será enviado.",
    });
  } catch (error) {
    console.error("[API] Forgot Password Error:", error);
    return apiError("Erro ao processar solicitação de recuperação de senha", 500);
  }
}
