"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

type State = { success?: boolean; error?: string; email?: string; phone?: string };

const contactSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  phone: z.string().trim().max(32).regex(/^\+?[\d ().-]+$/).transform(phone =>
    (phone.startsWith("+") ? "+" : "") + phone.replace(/\D/g, "")
  ).pipe(z.string().regex(/^\+?\d{8,15}$/)),
});

export async function submitBetaApplication(_state: State, form: FormData): Promise<State> {
  const email = String(form.get("email") ?? "").slice(0, 254);
  const phone = String(form.get("phone") ?? "").slice(0, 32);

  try {
    const user = await getAuthenticatedUser();
    if (user) {
      await prisma.betaApplication.create({ data: { userId: user.userId } });
      return { success: true };
    }
    if (form.get("account") === "true") {
      return { error: "Sua sessão expirou. Entre novamente para vincular a inscrição à sua conta." };
    }

    const contact = contactSchema.safeParse({ email: form.get("email"), phone: form.get("phone") });
    if (!contact.success) return { email, phone, error: "Informe um e-mail e um número de contato válidos, com DDD ou código de área." };

    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
    if (!await rateLimit("beta-application", ip, 20, 600)) {
      return { email, phone, error: "Muitas tentativas. Tente novamente em alguns minutos." };
    }

    await prisma.betaApplication.create({ data: contact.data });
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: true };
    }
    return { email, phone, error: "Não foi possível salvar a inscrição. Tente novamente." };
  }
}
