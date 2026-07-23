// ==============================================================================
// Seed: Planos Padrão do HiveNode
// ==============================================================================
// Executar com: npx ts-node prisma/seed-plans.ts
// ==============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_PLANS = [
  {
    slug: "founder",
    name: "Fundador",
    category: "GENERAL" as const,
    priceInCents: 0,
    maxDevices: 0, // 0 = ilimitado
    maxProxies: 0,
    gbIncluded: 0,
    gbPriceCents: 0,
    isRecurring: false,
    billingCycle: null,
    isPublic: false,
    isAdminOnly: true,
    extraDeviceCents: 0,
    extraProxyCents: 0,
  },
  {
    slug: "starter",
    name: "Starter",
    category: "PRIVATE_FLEET" as const,
    priceInCents: 4990, // R$ 49,90
    maxDevices: 2,
    maxProxies: 4,
    gbIncluded: 0,
    gbPriceCents: 0,
    isRecurring: true,
    billingCycle: "MONTHLY",
    isPublic: true,
    isAdminOnly: false,
    extraDeviceCents: 1490, // R$ 14,90
    extraProxyCents: 490,   // R$ 4,90
  },
  {
    slug: "pro",
    name: "Pro",
    category: "PRIVATE_FLEET" as const,
    priceInCents: 14990, // R$ 149,90
    maxDevices: 5,
    maxProxies: 15,
    gbIncluded: 0,
    gbPriceCents: 0,
    isRecurring: true,
    billingCycle: "MONTHLY",
    isPublic: true,
    isAdminOnly: false,
    extraDeviceCents: 1490,
    extraProxyCents: 490,
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    category: "PRIVATE_FLEET" as const,
    priceInCents: 39990, // R$ 399,90
    maxDevices: 50,
    maxProxies: 200,
    gbIncluded: 0,
    gbPriceCents: 0,
    isRecurring: true,
    billingCycle: "MONTHLY",
    isPublic: true,
    isAdminOnly: false,
    extraDeviceCents: 1490,
    extraProxyCents: 490,
  },
  {
    slug: "gb-basic",
    name: "Pacote Básico",
    category: "GLOBAL_FLEET" as const,
    priceInCents: 2500, // R$ 25,00
    maxDevices: 0,
    maxProxies: 0,
    gbIncluded: 1,
    gbPriceCents: 2500, // R$ 25/GB
    isRecurring: false,
    billingCycle: null,
    isPublic: true,
    isAdminOnly: false,
    extraDeviceCents: 0,
    extraProxyCents: 0,
  },
  {
    slug: "gb-intermediate",
    name: "Pacote Intermediário",
    category: "GLOBAL_FLEET" as const,
    priceInCents: 10000, // R$ 100,00
    maxDevices: 0,
    maxProxies: 0,
    gbIncluded: 5,
    gbPriceCents: 2000, // R$ 20/GB
    isRecurring: false,
    billingCycle: null,
    isPublic: true,
    isAdminOnly: false,
    extraDeviceCents: 0,
    extraProxyCents: 0,
  },
  {
    slug: "gb-advanced",
    name: "Pacote Avançado",
    category: "GLOBAL_FLEET" as const,
    priceInCents: 30000, // R$ 300,00
    maxDevices: 0,
    maxProxies: 0,
    gbIncluded: 20,
    gbPriceCents: 1500, // R$ 15/GB
    isRecurring: false,
    billingCycle: null,
    isPublic: true,
    isAdminOnly: false,
    extraDeviceCents: 0,
    extraProxyCents: 0,
  },
  {
    slug: "pay-as-you-go",
    name: "Pay-as-you-go",
    category: "PAY_PER_USE" as const,
    priceInCents: 0,
    maxDevices: 0,
    maxProxies: 0,
    gbIncluded: 0,
    gbPriceCents: 1500, // R$ 15/GB (mesmo do Avançado)
    isRecurring: false,
    billingCycle: null,
    isPublic: true,
    isAdminOnly: false,
    extraDeviceCents: 0,
    extraProxyCents: 0,
    minMonthsForPPU: 6,
    minAvgGbForPPU: 20,
  },
];

async function seedPlans() {
  console.log("🌱 Seeding plans...");

  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: { ...plan },
      create: { ...plan },
    });
    console.log(`  ✅ ${plan.name} (${plan.slug})`);
  }

  console.log("✅ All plans seeded successfully!");
}

seedPlans()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
