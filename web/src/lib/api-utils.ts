import { Queue } from "bullmq";
import { redis } from "./redis";

const errorQueue = new Queue("error-alerts", { connection: redis });

export function apiError(message: string, status: number = 400) {
  if (status === 500) {
    errorQueue.add("error-alert", { message }).catch(console.error);
  }
  return Response.json({ error: message, success: false }, { status });
}

export function apiSuccess<T>(data: T, status: number = 200) {
  return Response.json({ data, success: true, error: null }, { status });
}

export function generateSecureString(length: number = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}
