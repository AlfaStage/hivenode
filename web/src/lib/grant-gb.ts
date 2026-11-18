import "dotenv/config";
import { prisma } from "./prisma";

// Credita (ou debita, com valor negativo) saldo de GB de um usuario.
// Uso: GRANT_EMAIL=alguem@dominio.com GRANT_GB=100 npm run grant:gb
async function main() {
  const email = process.env.GRANT_EMAIL?.trim().toLowerCase();
  const amount = Number(process.env.GRANT_GB);
  if (!email) throw new Error("Provide GRANT_EMAIL");
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Provide GRANT_GB (numero diferente de zero)");
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, balanceGB: true } });
  if (!user) throw new Error("No account with this e-mail");
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { balanceGB: { increment: amount } },
    select: { balanceGB: true },
  });
  console.log(`Saldo de ${email}: ${user.balanceGB} GB -> ${updated.balanceGB} GB`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
