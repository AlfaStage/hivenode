import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";

// Memory/Mock store for system configuration (can be persisted to JSON or DB)
let systemSettings = {
  pricing: {
    residentialGbPrice: 5.0,
    mobileGbPrice: 2.5,
    byodMonthlyPrice: 19.9,
    minDepositGb: 10,
  },
  crypto: {
    pointsToHiveRate: 100, // 100 points = 1 $HIVE
    stakingRewardRate: 5.5, // 5.5% APY
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
  }
};

export async function GET() {
  try {
    await requireAdmin();
    return apiSuccess({ settings: systemSettings });
  } catch (error) {
    return apiError("Erro ao carregar configurações do sistema", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    if (body.pricing) {
      systemSettings.pricing = { ...systemSettings.pricing, ...body.pricing };
    }
    if (body.crypto) {
      systemSettings.crypto = { ...systemSettings.crypto, ...body.crypto };
    }
    if (body.general) {
      systemSettings.general = { ...systemSettings.general, ...body.general };
    }

    return apiSuccess({ settings: systemSettings, message: "Configurações salvas com sucesso!" });
  } catch (error) {
    return apiError("Erro ao atualizar configurações", 500);
  }
}
