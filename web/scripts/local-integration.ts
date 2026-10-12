import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID, createHmac } from "node:crypto";
import assert from "node:assert/strict";
import net from "node:net";
import { once } from "node:events";
import path from "node:path";
import { createRequire } from "node:module";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://hivenode_test:local-test-only@127.0.0.1:55432/hivenode_test",
  REDIS_URL: "redis://127.0.0.1:56379/0",
  JWT_SECRET: "local-test-jwt-secret-at-least-32-characters",
  ENCRYPTION_KEY: "local-test-encryption-key-at-least-32-characters",
  BROKER_INTERNAL_SECRET: "local-test-internal-secret-at-least-32-characters",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100", NEXT_PUBLIC_BROKER_URL: "ws://127.0.0.1:11001",
  BROKER_API_URL: "http://127.0.0.1:11001", WEB_API_URL: "http://127.0.0.1:3100",
  WEB_ORIGIN: "http://127.0.0.1:3100", SOCKS5_PORT: "11000", TUNNEL_PORT: "11001",
  APP_ENV: "test", ALLOW_PRIVATE_TARGETS: "true", NODE_ENV: "development",
});
const base = "http://127.0.0.1:3100";
const children: ChildProcess[] = [];
const sockets: net.Socket[] = [];
const require = createRequire(import.meta.url);
const WebSocket = require("../../hivedocker/node_modules/ws");
const devices: InstanceType<typeof WebSocket>[] = [];
let checks = 0;
function check(name: string) { console.log(`PASS ${++checks}: ${name}`); }
function launch(command: string, args: string[], cwd: string) {
  const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", data => { if (process.env.TEST_VERBOSE) process.stdout.write(data); });
  child.stderr?.on("data", data => { if (process.env.TEST_VERBOSE) process.stderr.write(data); });
  children.push(child); return child;
}
async function waitHealth(url: string) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Health timeout: ${url}`);
}
async function request(route: string, method = "GET", body?: unknown, token?: string, expected = 200) {
  const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(result)}`);
  return result.data;
}
async function readBytes(socket: net.Socket, length: number): Promise<Buffer> {
  const parts: Buffer[] = []; let size = 0;
  while (size < length) {
    const data = socket.read(length - size) as Buffer | null;
    if (data) { parts.push(data); size += data.length; }
    else { await Promise.race([once(socket, "readable"), new Promise((_, reject) => setTimeout(() => reject(new Error("Socket timeout")), 15000).unref())]); }
  }
  return Buffer.concat(parts);
}
async function proxyConnect(user: string, password: string, success = true) {
  const socket = net.connect(11000, "127.0.0.1"); sockets.push(socket); await once(socket, "connect");
  socket.write(Buffer.from([5, 1, 2])); assert.deepEqual(await readBytes(socket, 2), Buffer.from([5, 2]));
  socket.write(Buffer.concat([Buffer.from([1, user.length]), Buffer.from(user), Buffer.from([password.length]), Buffer.from(password)]));
  assert.deepEqual(await readBytes(socket, 2), Buffer.from([1, success ? 0 : 1]));
  if (!success) { socket.destroy(); return socket; }
  const host = Buffer.from("example.org");
  socket.write(Buffer.concat([Buffer.from([5, 1, 0, 3, host.length]), host, Buffer.from([1, 187])]));
  assert.equal((await readBytes(socket, 10))[1], 0);
  return socket;
}
async function device(node: { id: string }, secret: string, marker: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${node.id}:${timestamp}`).digest("hex");
  const ws = new WebSocket(`ws://127.0.0.1:11001/tunnel?nodeId=${node.id}&ts=${timestamp}&sig=${sig}`);
  devices.push(ws); await once(ws, "open");
  ws.on("message", (data: Buffer, binary: boolean) => {
    if (binary) {
      const length = data[0];
      ws.send(Buffer.concat([data.subarray(0, 1 + length), Buffer.from(marker), data.subarray(1 + length)]));
    } else {
      const message = JSON.parse(data.toString());
      if (message.type === "DIAL") {
        assert.equal(message.host, "example.org:443");
        ws.send(JSON.stringify({ type: "DIAL_OK", connId: message.connId }));
      }
    }
  });
  return ws;
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { hashPassword, generatePasswordResetToken } = await import("../src/lib/auth");
  const { processPaymentEvent } = await import("../src/lib/payment-events");
  try {
    launch(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3100", "--hostname", "127.0.0.1"], process.cwd());
    await waitHealth(base + "/api/health");
    launch("go", ["run", "./cmd/broker"], path.resolve("../broker"));
    await waitHealth("http://127.0.0.1:11001/health");
    const run = randomUUID().slice(0, 8);
    const password = "Local-Test-Password-123!";
    const a = await request("/api/auth/register", "POST", { email: `${run}-a@alfastage.com.br`, password }, undefined, 201);
    const b = await request("/api/auth/register", "POST", { email: `${run}-b@example.com`, password }, undefined, 201);
    assert.equal(a.user.role, "CUSTOMER"); check("public registration never grants admin");
    const denied = await fetch(base + "/api/admin", { headers: { Authorization: `Bearer ${a.token}` } }); assert.equal(denied.status, 403);
    assert.equal((await fetch(base + "/api/clean")).status, 410); check("admin data and retired reset endpoint protected");
    const admin = await prisma.user.create({ data: { email: `${run}-admin@example.com`, passwordHash: await hashPassword(password), role: "ADMIN" } });
    const login = await request("/api/auth/login", "POST", { email: admin.email, password });
    const plan = await prisma.plan.create({ data: { slug: `${run}-private`, name: "Local test fleet", category: "PRIVATE_FLEET", maxDevices: 2, maxProxies: 4, priceInCents: 1000, isRecurring: true } });
    for (const user of [a.user, b.user]) await prisma.subscription.create({ data: { userId: user.id, planId: plan.id, planType: "STARTER", planCategory: "PRIVATE_FLEET", currentPeriodEnd: new Date(Date.now() + 86400000) } });
    const plans = await request("/api/plans"); assert(plans.plans.some((p: { id: string }) => p.id === plan.id)); check("customers can read commercial plans");
    const na = await request("/api/nodes", "POST", { deviceName: "A", visibility: "PRIVATE", installationId: `${run}-installation-a` }, a.token);
    const nb = await request("/api/nodes", "POST", { deviceName: "B", visibility: "PRIVATE", installationId: `${run}-installation-b` }, b.token);
    const again = await request("/api/nodes", "POST", { deviceName: "A", visibility: "PRIVATE", installationId: `${run}-installation-a` }, a.token);
    assert.equal(again.node.id, na.node.id); check("device registration is idempotent");
    await request("/api/proxies", "POST", { nodeId: nb.node.id, proxyUser: `${run}-stolen`, proxyPass: password }, a.token, 403); check("cross-tenant proxy creation rejected");
    const proxy = await request("/api/proxies", "POST", { nodeId: na.node.id, proxyUser: `${run}-proxy`, proxyPass: password }, a.token, 201);
    await device(nb.node, nb.tunnelSecret, "B:"); await device(na.node, na.tunnelSecret, "A:");
    await Promise.all(Array.from({ length: 4 }, async () => {
      const socket = await proxyConnect(proxy.proxy.proxyUser, password); socket.write("hello");
      assert.equal((await readBytes(socket, 7)).toString(), "A:hello"); socket.destroy();
    }));
    check("concurrent SOCKS5 streams route exclusively to authorized device; DNS name preserved");
    const credentials = await request("/api/proxies", "GET", undefined, a.token);
    assert.equal(credentials.proxies[0].proxyPass, password); check("copied proxy password is usable, not bcrypt hash");
    const rotated = await request(`/api/proxies/${proxy.proxy.id}/rotate`, "POST", {}, a.token);
    await proxyConnect(proxy.proxy.proxyUser, password, false);
    const fresh = await proxyConnect(proxy.proxy.proxyUser, rotated.proxyPass); fresh.write("ok"); assert.equal((await readBytes(fresh, 4)).toString(), "A:ok"); fresh.destroy(); check("rotation rejects old password and accepts new password");
    await request(`/api/admin/proxies/${proxy.proxy.id}`, "PUT", { status: "BLOCKED" }, login.token);
    await proxyConnect(proxy.proxy.proxyUser, rotated.proxyPass, false); check("administrative block stops real access");
    const reset = await generatePasswordResetToken(a.user.id);
    await request("/api/auth/me", "GET", undefined, reset, 401); check("password-reset JWT cannot act as session");
    const qr = await request("/api/auth/qr-link", "GET", undefined, login.token);
    const qrLogin = await request("/api/auth/qr-login", "POST", { linkToken: qr.linkToken });
    await request("/api/admin", "GET", undefined, qrLogin.token, 403);
    await request("/api/auth/qr-login", "POST", { linkToken: qr.linkToken }, undefined, 401); check("pairing token single use and device session cannot administer");
    await prisma.user.update({ where: { id: b.user.id }, data: { hivePoints: 500 } });
    const redemptions = await Promise.all(Array.from({ length: 5 }, () => fetch(base + "/api/billing/redeem-points", { method: "POST", headers: { Authorization: `Bearer ${b.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ pointsToRedeem: 500 }) })));
    assert.equal(redemptions.filter(r => r.ok).length, 1);
    const balance = await prisma.user.findUniqueOrThrow({ where: { id: b.user.id } }); assert.equal(balance.hivePoints, 0); assert.equal(balance.balanceGB, 1); check("concurrent redemption never overspends points");
    const subscription = await prisma.subscription.create({ data: { userId: b.user.id, planId: plan.id, planType: "STARTER", status: "PENDING", currentPeriodEnd: new Date(), abacatePaySubId: `subs-${run}` } });
    for (const month of [1, 2]) {
      const event = { id: `evt-${run}-${month}`, event: "subscription.renewed", data: { subscription: { id: subscription.abacatePaySubId, amount: 1000 }, payment: { id: `charge-${run}-${month}`, paidAmount: 1000, updatedAt: `2026-0${month}-01T00:00:00Z` } } };
      await processPaymentEvent(event); await processPaymentEvent(event);
    }
    assert.equal(await prisma.payment.count({ where: { abacateSubId: subscription.abacatePaySubId } }), 2); check("multiple renewals recorded once each");
    const usage = await prisma.usageEvent.findMany({ where: { proxyId: proxy.proxy.id } }); assert(usage.length > 0); check("proxy consumption persisted by credential");
    console.log(`LOCAL INTEGRATION: ${checks} checks passed`);
  } finally {
    for (const ws of devices) ws.terminate(); for (const socket of sockets) socket.destroy();
    for (const child of children) {
      if (child.pid && process.platform === "win32") spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else child.kill("SIGTERM");
    }
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
