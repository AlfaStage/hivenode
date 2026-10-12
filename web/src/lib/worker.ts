import "dotenv/config";
import { prisma } from "./prisma";
let stopping = false;
async function tick() {
  const now = new Date();
  await prisma.subscription.updateMany({ where: { status: "ACTIVE", currentPeriodEnd: { lt: now } }, data: { status: "PAST_DUE" } });
  await prisma.oneTimeToken.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.systemConfig.upsert({ where: { key: "worker_heartbeat" }, create: { key: "worker_heartbeat", value: now.toISOString() }, update: { value: now.toISOString() } });
}
async function main() {
  while (!stopping) {
    try { await tick(); } catch (error) { console.error("[Worker]", error); }
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  await prisma.$disconnect();
}
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
void main();
