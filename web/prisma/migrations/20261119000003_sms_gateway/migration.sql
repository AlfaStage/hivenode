-- AlterTable
ALTER TABLE "sms_pilot_devices" ADD COLUMN     "gateway" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gatewayEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sms_gateway_sims" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedNumber" TEXT,
    "numberHash" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sms_gateway_sims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_gateway_contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "destinationHash" TEXT NOT NULL,
    "maskedNumber" TEXT NOT NULL,
    "encryptedNumber" TEXT,
    "lastConsentAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "optOutKeyword" TEXT,

    CONSTRAINT "sms_gateway_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_gateway_activity" (
    "simId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_gateway_activity_pkey" PRIMARY KEY ("simId","contactId")
);

-- CreateIndex
CREATE INDEX "sms_gateway_sims_deviceId_available_idx" ON "sms_gateway_sims"("deviceId", "available");

-- CreateIndex
CREATE INDEX "sms_gateway_contacts_userId_optedOutAt_id_idx" ON "sms_gateway_contacts"("userId", "optedOutAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sms_gateway_contacts_userId_destinationHash_key" ON "sms_gateway_contacts"("userId", "destinationHash");

-- CreateIndex
CREATE INDEX "sms_gateway_activity_simId_lastSentAt_idx" ON "sms_gateway_activity"("simId", "lastSentAt");

-- CreateIndex
CREATE INDEX "sms_pilot_messages_userId_destinationHash_state_idx" ON "sms_pilot_messages"("userId", "destinationHash", "state");

-- AddForeignKey
ALTER TABLE "sms_gateway_sims" ADD CONSTRAINT "sms_gateway_sims_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sms_pilot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_gateway_contacts" ADD CONSTRAINT "sms_gateway_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_gateway_activity" ADD CONSTRAINT "sms_gateway_activity_simId_fkey" FOREIGN KEY ("simId") REFERENCES "sms_gateway_sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_gateway_activity" ADD CONSTRAINT "sms_gateway_activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "sms_gateway_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "sms_gateway_contacts" ("id", "userId", "destinationHash", "maskedNumber", "lastConsentAt")
SELECT gen_random_uuid()::text, device."userId", destination->>'hash', destination->>'mask', device."approvedAt"
FROM "sms_pilot_devices" AS device
CROSS JOIN LATERAL jsonb_array_elements(device."approvedDestinations") AS destination
WHERE device."revokedAt" IS NULL AND device."approvedAt" IS NOT NULL
  AND destination->>'hash' IS NOT NULL AND destination->>'mask' IS NOT NULL
ON CONFLICT ("userId", "destinationHash") DO NOTHING;
