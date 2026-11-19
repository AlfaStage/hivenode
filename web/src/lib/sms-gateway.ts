import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { decrypt, encrypt } from "@/lib/crypto";
import { bindingId, destination, destinationFingerprint, maskPhone } from "@/lib/sms-pilot";

export const gatewayConsentVersion = "gateway-br-1";
export const smsOptOutKeyword = z.enum(["SAIR", "NAO_RECEBER", "STOP", "CANCELAR", "PARE"]);
export const gatewaySims = z.array(z.strictObject({
  id: bindingId, slot: z.number().int().min(0).max(8), label: z.string().trim().min(1).max(48),
  phoneNumber: destination.nullable(),
})).max(8).refine(items => new Set(items.map(item => item.id)).size === items.length);
export const gatewayOptOuts = z.array(z.strictObject({ destination, keyword: smsOptOutKeyword })).max(50);

export function visibleNumber(encrypted: string | null) {
  return (encrypted && decrypt(encrypted)) || null;
}

export async function updateGatewaySims(tx: Prisma.TransactionClient, deviceId: string, userId: string,
  sims: z.infer<typeof gatewaySims>) {
  const existing = await tx.smsGatewaySim.findMany({ where: { deviceId } });
  const byId = new Map(existing.map(sim => [sim.id, sim]));
  const visible = sims.map(sim => sim.id);
  if (existing.some(sim => sim.available && !visible.includes(sim.id))) {
    await tx.smsGatewaySim.updateMany({ where: { deviceId, available: true, id: { notIn: visible } }, data: { available: false } });
  }
  for (const sim of sims) {
    const current = byId.get(sim.id);
    const numberHash = sim.phoneNumber ? destinationFingerprint(userId, sim.phoneNumber) : null;
    if (current?.available && current.label === sim.label && current.slot === sim.slot && current.numberHash === numberHash) continue;
    const data = {
      slot: sim.slot, label: sim.label, available: true, numberHash,
      encryptedNumber: numberHash && sim.phoneNumber
        ? (current?.numberHash === numberHash ? current.encryptedNumber : encrypt(sim.phoneNumber)) : null,
    };
    if (current) await tx.smsGatewaySim.update({ where: { id: sim.id }, data });
    else await tx.smsGatewaySim.create({ data: { id: sim.id, deviceId, ...data } });
  }
}

export async function optOutKnownContacts(tx: Prisma.TransactionClient, userId: string, entries: z.infer<typeof gatewayOptOuts>, now: Date) {
  for (const entry of entries) {
    const hash = destinationFingerprint(userId, entry.destination);
    const changed = await tx.smsGatewayContact.updateMany({
      where: { userId, destinationHash: hash, optedOutAt: null },
      data: { optedOutAt: now, optOutKeyword: entry.keyword },
    });
    if (!changed.count) continue;
    await tx.smsPilotMessage.updateMany({
      where: { userId, destinationHash: hash, state: "QUEUED" },
      data: { state: "CANCELED", errorCode: "OPTED_OUT", encryptedPayload: null },
    });
  }
}

export async function registerConsentedContact(tx: Prisma.TransactionClient, userId: string, hash: string, to: string, now: Date) {
  const contact = await tx.smsGatewayContact.findUnique({ where: { userId_destinationHash: { userId, destinationHash: hash } } });
  if (contact?.optedOutAt) return false;
  if (contact) {
    await tx.smsGatewayContact.update({ where: { id: contact.id }, data: {
      lastConsentAt: now, encryptedNumber: contact.encryptedNumber ?? encrypt(to),
    } });
  } else {
    await tx.smsGatewayContact.create({ data: { userId, destinationHash: hash, maskedNumber: maskPhone(to),
      encryptedNumber: encrypt(to), lastConsentAt: now } });
  }
  return true;
}

export async function recordGatewaySend(tx: Prisma.TransactionClient, userId: string, deviceId: string,
  simId: string, hash: string, lastSentAt: Date) {
  const sim = await tx.smsGatewaySim.findFirst({ where: { id: simId, deviceId }, select: { id: true } });
  if (!sim) return;
  const contact = await tx.smsGatewayContact.findUnique({ where: { userId_destinationHash: { userId, destinationHash: hash } },
    select: { id: true } });
  if (!contact) return;
  const key = { simId, contactId: contact.id };
  await tx.smsGatewayActivity.upsert({
    where: { simId_contactId: key }, update: { lastSentAt }, create: { ...key, lastSentAt },
  });
}
