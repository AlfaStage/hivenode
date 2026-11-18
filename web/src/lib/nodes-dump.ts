import "dotenv/config";
import { prisma } from "./prisma";
import { redis } from "./redis";

// Diagnostico somente leitura: mostra nos, estado online no Redis e proxies criados.
// Uso: npm run nodes:dump
async function main() {
  const nodes = await prisma.node.findMany({
    select: { id: true, deviceModel: true, visibility: true, status: true, type: true,
      userId: true, installationId: true, createdAt: true },
    orderBy: { createdAt: "desc" }, take: 50,
  });
  console.log(`NOS: ${nodes.length}`);
  for (const node of nodes) {
    const online = await redis.get(`node:online:${node.id}`);
    const proxies = await prisma.proxyCredential.count({ where: { nodeId: node.id } });
    console.log([
      `id=${node.id}`, `nome=${node.deviceModel}`, `visibilidade=${node.visibility}`,
      `status=${node.status}`, `tipo=${node.type}`, `dono=${node.userId ?? "SEM DONO"}`,
      `online_redis=${online ? "SIM" : "NAO"}`, `proxies=${proxies}`,
    ].join(" | "));
  }
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, disabled: true } });
  console.log(`\nUSUARIOS: ${users.length}`);
  for (const user of users) console.log(`id=${user.id} | ${user.email} | ${user.role} | desativado=${user.disabled}`);
  console.log(`\nPROXIES NO TOTAL: ${await prisma.proxyCredential.count()}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); redis.disconnect(); });
