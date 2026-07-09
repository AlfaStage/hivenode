// ==============================================================================
// Redis Connection Singleton
// ==============================================================================
// Conexão com Redis externo via ioredis.
// Usado pelo BullMQ, Auth, e comunicação com o Broker Go.
// ==============================================================================

import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  return new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Necessário para BullMQ
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    reconnectOnError(err: Error) {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
