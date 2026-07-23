// ==============================================================================
// Lib: AbacatePay v2 Integration
// ==============================================================================

import { prisma } from "@/lib/prisma";

const ABACATE_BASE_URL = "https://api.abacatepay.com/v2";

// Busca a API Key do banco de dados (nunca de env)
async function getApiKey(): Promise<string | null> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "abacatepay_api_key" },
    });
    return config?.value || null;
  } catch {
    return process.env.ABACATE_PAY_API_KEY || null;
  }
}

// Helper: faz request autenticado na API AbacatePay v2
async function abacateRequest(path: string, method: string = "GET", body?: unknown) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("AbacatePay API Key não configurada");

  const res = await fetch(`${ABACATE_BASE_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[AbacatePay] Erro:", data);
    throw new Error(data.error || `AbacatePay error: ${res.status}`);
  }
  return data;
}

// Criar/Atualizar um produto na AbacatePay
export async function createProduct(plan: {
  slug: string;
  name: string;
  priceInCents: number;
  isRecurring: boolean;
  billingCycle?: string | null;
}) {
  const body: Record<string, unknown> = {
    externalId: `hivenode_plan_${plan.slug}`,
    name: `HiveNode - ${plan.name}`,
    price: plan.priceInCents,
    currency: "BRL",
  };

  if (plan.isRecurring && plan.billingCycle) {
    body.cycle = plan.billingCycle;
  }

  return abacateRequest("/products/create", "POST", body);
}

// Criar cliente no AbacatePay
export async function createCustomer(email: string, name?: string) {
  return abacateRequest("/customers/create", "POST", {
    email,
    name: name || email.split("@")[0],
  });
}

// Criar Checkout (compra única - pacotes GB)
export async function createCheckout(options: {
  productId: string;
  customerId?: string;
  returnUrl: string;
  metadata?: Record<string, string>;
  coupons?: string[];
}) {
  const body: Record<string, unknown> = {
    items: [{ id: options.productId, quantity: 1 }],
    methods: ["PIX"],
    returnUrl: options.returnUrl,
    metadata: {
      ...options.metadata,
      system: "hivenode",
    },
  };

  if (options.customerId) body.customerId = options.customerId;
  if (options.coupons?.length) body.coupons = options.coupons;

  return abacateRequest("/checkouts/create", "POST", body);
}

// Criar Assinatura (planos recorrentes - Starter/Pro/Enterprise)
export async function createSubscription(options: {
  productId: string;
  customerId?: string;
  returnUrl: string;
  metadata?: Record<string, string>;
  coupons?: string[];
}) {
  const body: Record<string, unknown> = {
    items: [{ id: options.productId, quantity: 1 }],
    methods: ["PIX", "CARD"],
    returnUrl: options.returnUrl,
    metadata: {
      ...options.metadata,
      system: "hivenode",
    },
  };

  if (options.customerId) body.customerId = options.customerId;
  if (options.coupons?.length) body.coupons = options.coupons;

  return abacateRequest("/subscriptions/create", "POST", body);
}

// Cancelar Assinatura
export async function cancelSubscription(subscriptionId: string) {
  return abacateRequest("/subscriptions/cancel", "POST", { id: subscriptionId });
}

// Criar Cupom
export async function createCoupon(code: string, percentOff: number) {
  return abacateRequest("/coupons/create", "POST", {
    code,
    percentOff,
    maxRedemptions: 100,
  });
}

// Reembolsar checkout
export async function refundCheckout(checkoutId: string) {
  return abacateRequest("/checkouts/refund", "POST", { id: checkoutId });
}

// Listar produtos
export async function listProducts() {
  return abacateRequest("/products/list");
}

// Verificar HMAC de webhook
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return signature === digest;
}
