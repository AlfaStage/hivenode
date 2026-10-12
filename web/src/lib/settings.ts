import { prisma } from "./prisma";

export interface SystemSettings {
  pricing: {
    residentialGbPrice: number;
    mobileGbPrice: number;
    byodMonthlyPrice: number;
    minDepositGb: number;
  };
  crypto: {
    pointsToHiveRate: number;
    stakingRewardRate: number;
    network: string;
    tokenAddress: string;
    minWithdrawalPoints: number;
    contractStatus: string;
  };
  general: {
    maintenanceMode: boolean;
    smtpHost: string;
    smtpSender: string;
    smtpStatus: string;
    lgpdAuditEnabled: boolean;
  };
}

const DEFAULT_SETTINGS: SystemSettings = {
  pricing: {
    residentialGbPrice: 5.0,
    mobileGbPrice: 2.5,
    byodMonthlyPrice: 19.9,
    minDepositGb: 10,
  },
  crypto: {
    pointsToHiveRate: 500,
    stakingRewardRate: 5.5,
    network: "Polygon Mainnet",
    tokenAddress: "",
    minWithdrawalPoints: 500,
    contractStatus: "NOT_CONFIGURED",
  },
  general: {
    maintenanceMode: false,
    smtpHost: "smtp-relay.brevo.com",
    smtpSender: "hivenode@alfastage.com.br",
    smtpStatus: "NOT_CONFIGURED",
    lgpdAuditEnabled: true,
  },
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const row = await prisma.systemConfig.findUnique({ where: { key: "system_settings" } });
  const saved = row ? JSON.parse(row.value) : {};
  return { pricing: { ...DEFAULT_SETTINGS.pricing, ...saved.pricing },
    crypto: { ...DEFAULT_SETTINGS.crypto, ...saved.crypto }, general: { ...DEFAULT_SETTINGS.general, ...saved.general } };
}

export async function updateSystemSettings(partial: Partial<SystemSettings>): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const updated = { pricing: { ...current.pricing, ...partial.pricing },
    crypto: { ...current.crypto, ...partial.crypto }, general: { ...current.general, ...partial.general } };
  if (!Number.isFinite(updated.crypto.pointsToHiveRate) || updated.crypto.pointsToHiveRate < 100 ||
      Object.values(updated.pricing).some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
    throw new Error("Invalid settings");
  }
  await prisma.systemConfig.upsert({ where: { key: "system_settings" },
    create: { key: "system_settings", value: JSON.stringify(updated) }, update: { value: JSON.stringify(updated) } });
  return updated;
}
