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
