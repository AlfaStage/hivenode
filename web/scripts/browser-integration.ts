import "./test-env";
import { cp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { hashPassword, generateToken } from "../src/lib/auth";
import { checkBrowser } from "./browser-check";
const base = "http://127.0.0.1:3100";
async function main() {
  if (process.env.TEST_PRODUCTION_BUILD === "true") Object.assign(process.env, { NODE_ENV: "production" });
  const production = process.env.TEST_PRODUCTION_BUILD === "true";
  if (production) {
    await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
    await cp("public", ".next/standalone/public", { recursive: true });
  }
  const args = production ? [".next/standalone/server.js"] : ["node_modules/next/dist/bin/next", "dev", "--port", "3100", "--hostname", "127.0.0.1"];
  const next = spawn(process.execPath, args, { stdio: "inherit", env: { ...process.env, PORT: "3100", HOSTNAME: "127.0.0.1" } });

  try {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      try { if ((await fetch(base + "/api/health", { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error("Web test server did not become ready");
    const password = "Local-Test-Password-123!";
    const hash = await hashPassword(password);
    const email = randomUUID() + "@example.com";
    await prisma.user.create({ data: { email, passwordHash: hash } });
    const admin = await prisma.user.create({ data: { email: randomUUID() + "@example.com", passwordHash: hash, role: "ADMIN" } });
    await checkBrowser(base, email, password, await generateToken(admin.id, admin.role));
    console.log("BROWSER INTEGRATION: passed");
  } finally {
    if (next.pid && process.platform === "win32") spawn("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore" });
    else next.kill("SIGTERM");
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
