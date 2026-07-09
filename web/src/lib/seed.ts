// ==============================================================================
// Database Seed Script — Admin User
// ==============================================================================
// Uso: npm run db:seed
// Cria o primeiro usuário ADMIN do sistema.
// Regra: Apenas usuários com domínio @alfastage.com.br são admin.
// ==============================================================================

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcryptjs from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "admin@alfastage.com.br";
const ADMIN_PASSWORD = "admin123456";

async function main() {
  console.log("🌱 Seeding database...\n");

  // Verificar se admin já existe
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    console.log(`⚠️  Admin já existe: ${ADMIN_EMAIL}`);
    console.log("   Seed cancelado.\n");
    return;
  }

  // Criar o admin
  const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
      balanceGB: 999999,
    },
  });

  console.log("✅ Admin criado com sucesso!");
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Senha: ${ADMIN_PASSWORD}`);
  console.log(`   ID:    ${admin.id}`);
  console.log(`   Role:  ${admin.role}\n`);
  console.log("⚠️  IMPORTANTE: Altere a senha padrão após o primeiro login!");
  console.log("📌 REGRA: Qualquer email *@alfastage.com.br será reconhecido como admin.\n");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
