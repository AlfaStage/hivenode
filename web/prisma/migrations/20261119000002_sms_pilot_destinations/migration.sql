ALTER TABLE "sms_pilot_devices" ADD COLUMN "approvedDestinations" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "sms_pilot_messages" ADD COLUMN "destinationHash" TEXT;

UPDATE "sms_pilot_devices"
SET "approvedDestinations" = jsonb_build_array(jsonb_build_object(
    'id', "id", 'hash', "destinationHash", 'mask', "destinationMask"
))
WHERE "approvedBinding" IS NOT NULL AND "approvedAt" IS NOT NULL
  AND "pendingBinding" IS NULL AND "revokedAt" IS NULL
  AND "destinationHash" IS NOT NULL AND "destinationMask" IS NOT NULL;

UPDATE "sms_pilot_messages" AS message
SET "destinationHash" = device."destinationHash"
FROM "sms_pilot_devices" AS device
WHERE message."deviceId" = device."id" AND message."bindingId" = device."approvedBinding"
  AND message."state" = 'QUEUED' AND device."approvedDestinations" <> '[]'::jsonb;
