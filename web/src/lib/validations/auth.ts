// ==============================================================================
// Zod Validation Schemas — Auth
// ==============================================================================

import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email("E-mail inválido")
    .min(1, "E-mail é obrigatório"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export const registerSchema = z.object({
  email: z
    .string()
    .email("E-mail inválido")
    .min(1, "E-mail é obrigatório"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(128, "Senha deve ter no máximo 128 caracteres"),
  confirmPassword: z
    .string()
    .min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
