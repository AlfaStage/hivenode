// ==============================================================================
// Prisma Configuration (Prisma 7+)
// ==============================================================================
// Define a URL de conexão ao banco de dados fora do schema.prisma.
// ==============================================================================

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    path: "prisma/migrations",
  },
});
