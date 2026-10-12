import "dotenv/config";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 16) throw new Error("Provide ADMIN_EMAIL and ADMIN_PASSWORD (16+ characters)");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Account already exists; seed never changes existing roles or passwords");
  await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), role: "ADMIN" } });
  console.log("Administrator created. Password was not logged.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
