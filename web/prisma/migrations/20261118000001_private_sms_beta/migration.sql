ALTER TABLE "users" ADD COLUMN "smsBetaAccess" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "SmsBetaScenario" AS ENUM ('DELIVERED', 'SENT', 'FAILED', 'UNKNOWN');
CREATE TYPE "SmsBetaState" AS ENUM ('QUEUED', 'DELIVERED', 'SENT', 'FAILED', 'UNKNOWN', 'CANCELED');

CREATE TABLE "sms_beta_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "maskedDestination" TEXT NOT NULL,
    "scenario" "SmsBetaScenario" NOT NULL,
    "state" "SmsBetaState" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sms_beta_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sms_beta_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sms_beta_messages_userId_idempotencyKey_key" ON "sms_beta_messages"("userId", "idempotencyKey");
CREATE INDEX "sms_beta_messages_userId_createdAt_id_idx" ON "sms_beta_messages"("userId", "createdAt", "id");
CREATE INDEX "sms_beta_messages_createdAt_idx" ON "sms_beta_messages"("createdAt");
