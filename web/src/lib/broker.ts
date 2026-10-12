import { timingSafeEqual } from "node:crypto";

export function requireInternal(request: Request) {
  const expected = process.env.BROKER_INTERNAL_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!expected || expected.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new Error("Forbidden");
}

export async function brokerCommand(path: string, body: unknown) {
  const base = process.env.BROKER_API_URL || "http://127.0.0.1:10001";
  const response = await fetch(`${base}${path}`, { method: "POST", headers: {
    Authorization: `Bearer ${process.env.BROKER_INTERNAL_SECRET}`, "Content-Type": "application/json",
  }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Broker command failed: ${response.status}`);
}
