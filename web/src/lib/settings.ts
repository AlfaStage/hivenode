import fs from "fs";
import path from "path";

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
    pointsToHiveRate: 100,
    stakingRewardRate: 5.5,
    network: "Polygon Mainnet",
    tokenAddress: "0x7a77...hivenode",
    minWithdrawalPoints: 500,
    contractStatus: "ACTIVE",
  },
  general: {
    maintenanceMode: false,
    smtpHost: "smtp-relay.brevo.com",
    smtpSender: "hivenode@alfastage.com.br",
    smtpStatus: "CONNECTED",
    lgpdAuditEnabled: true,
  },
};

const SETTINGS_FILE_PATH = path.join(process.cwd(), ".temp", "system_settings.json");

export function getSystemSettings(): SystemSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const content = fs.readFileSync(SETTINGS_FILE_PATH, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
    }
  } catch (error) {
    console.error("[Settings] Erro ao ler configurações persistidas:", error);
  }
  return DEFAULT_SETTINGS;
}

export function updateSystemSettings(partialSettings: Partial<SystemSettings>): SystemSettings {
  try {
    const current = getSystemSettings();
    const updated: SystemSettings = {
      pricing: { ...current.pricing, ...partialSettings.pricing },
      crypto: { ...current.crypto, ...partialSettings.crypto },
      general: { ...current.general, ...partialSettings.general },
    };

    const dir = path.dirname(SETTINGS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  } catch (error) {
    console.error("[Settings] Erro ao salvar configurações persistidas:", error);
    throw error;
  }
}
