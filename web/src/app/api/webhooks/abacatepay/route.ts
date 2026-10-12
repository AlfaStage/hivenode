import { createHmac, timingSafeEqual } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { processPaymentEvent } from "@/lib/payment-events";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
const publicKey = "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";
function equal(a: string, b: string) { return Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
export async function POST(request: Request) {
  try {
    const saved = await prisma.systemConfig.findUnique({ where: { key: "abacatepay_webhook_secret" } });
    const secret = saved ? (decrypt(saved.value) || saved.value) : process.env.ABACATE_PAY_WEBHOOK_SECRET;
    if (!secret) return apiError("Webhook not configured", 503);
    if (!equal(new URL(request.url).searchParams.get("webhookSecret") || "", secret)) return apiError("Unauthorized", 401);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1048576) return apiError("Payload too large", 413);
    const expected = createHmac("sha256", publicKey).update(raw).digest("base64");
    if (!equal(request.headers.get("x-webhook-signature") || "", expected)) return apiError("Invalid signature", 401);
    return apiSuccess(await processPaymentEvent(JSON.parse(raw)));
  } catch (error) { console.error("[Webhook] Processing failed", error); return apiError("Processing failed; retry required", 500); }
}
