-- CreateEnum
CREATE TYPE "SmsPilotState" AS ENUM ('QUEUED', 'AUTHORIZED', 'SENT', 'DELIVERED', 'FAILED', 'PARTIAL', 'UNKNOWN', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "sms_pilot_pairs" (
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_pilot_pairs_pkey" PRIMARY KEY ("codeHash")
);

-- CreateTable
CREATE TABLE "sms_pilot_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "bindings" JSONB NOT NULL DEFAULT '[]',
    "consentVersion" TEXT,
    "selectedBinding" TEXT,
    "approvedBinding" TEXT,
    "pendingBinding" TEXT,
    "destinationHash" TEXT,
    "destinationMask" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_pilot_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_pilot_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sms_pilot_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_pilot_messages" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "maskedDestination" TEXT NOT NULL,
    "encryptedPayload" TEXT,
    "state" "SmsPilotState" NOT NULL DEFAULT 'QUEUED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "grantExpiresAt" TIMESTAMP(3),
    "eventVersion" INTEGER NOT NULL DEFAULT 0,
    "sentParts" INTEGER NOT NULL DEFAULT 0,
    "deliveredParts" INTEGER NOT NULL DEFAULT 0,
    "failedParts" INTEGER NOT NULL DEFAULT 0,
    "totalParts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_pilot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_pilot_pairs_userId_idx" ON "sms_pilot_pairs"("userId");

-- CreateIndex
CREATE INDEX "sms_pilot_pairs_expiresAt_idx" ON "sms_pilot_pairs"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sms_pilot_devices_tokenHash_key" ON "sms_pilot_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "sms_pilot_devices_userId_revokedAt_idx" ON "sms_pilot_devices"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sms_pilot_keys_tokenHash_key" ON "sms_pilot_keys"("tokenHash");

-- CreateIndex
CREATE INDEX "sms_pilot_keys_userId_revokedAt_idx" ON "sms_pilot_keys"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sms_pilot_messages_userId_createdAt_idx" ON "sms_pilot_messages"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "sms_pilot_messages_deviceId_state_createdAt_idx" ON "sms_pilot_messages"("deviceId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "sms_pilot_messages_state_expiresAt_idx" ON "sms_pilot_messages"("state", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sms_pilot_messages_userId_idempotencyKey_key" ON "sms_pilot_messages"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "sms_pilot_pairs" ADD CONSTRAINT "sms_pilot_pairs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_pilot_devices" ADD CONSTRAINT "sms_pilot_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_pilot_keys" ADD CONSTRAINT "sms_pilot_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_pilot_messages" ADD CONSTRAINT "sms_pilot_messages_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sms_pilot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
