// ==============================================================================
// PrismaClient Singleton (Prisma 7 + pg Adapter)
// ==============================================================================
// Evita múltiplas instâncias em hot-reload do Next.js (dev mode).
// Usa o driver adapter @prisma/adapter-pg para Prisma 7.
// ==============================================================================

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || "postgresql://hivenode_user:hivenode_dev_2026@localhost:5432/hivenode";
  const cleanUrl = dbUrl.split("?")[0]; // Remove query params to avoid pg-pool SCRAM issue

  const pool = new pg.Pool({
    connectionString: cleanUrl,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}


export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
