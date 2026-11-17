import "dotenv/config";
import { prisma } from "./prisma";
import { generatePasswordResetToken } from "./auth";

// Gera um link de redefinicao de senha sem depender de SMTP.
// Uso: RESET_EMAIL=alguem@dominio.com npm run auth:reset-link
async function main() {
  const email = process.env.RESET_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Provide RESET_EMAIL");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("No account with this e-mail");
  const token = await generatePasswordResetToken(user.id);
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_APP_URL is required");
  console.log(`RESET_URL ${origin}/reset-password?token=${token}`);
  console.log("Expires in 15 minutes and can be used once.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
