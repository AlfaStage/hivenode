import { createHash } from "node:crypto";
import { redis } from "./redis";

export async function rateLimit(scope: string, identity: string, limit = 10, seconds = 900) {
  const key = `ratelimit:${scope}:${createHash("sha256").update(identity).digest("hex")}`;
  const count = await redis.eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
    1, key, seconds);
  return Number(count) <= limit;
}
