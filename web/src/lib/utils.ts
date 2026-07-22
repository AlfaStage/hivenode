// ==============================================================================
// Utility Functions
// ==============================================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

/**
 * Merge Tailwind CSS classes condicionalmente (com twMerge para Shadcn UI).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gera uma string aleatória segura para uso como proxyUser/proxyPass.
 */
export function generateSecureString(length: number = 16): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

/**
 * Gera credenciais SOCKS5 únicas para um Node.
 */
export function generateProxyCredentials(): {
  proxyUser: string;
  proxyPass: string;
} {
  return {
    proxyUser: `hv_${generateSecureString(12)}`,
    proxyPass: generateSecureString(24),
  };
}

/**
 * Formata bytes para uma string legível (KB, MB, GB).
 */
export function formatBytes(bytes: number | bigint): string {
  const num = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (num === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(num) / Math.log(k));

  return `${parseFloat((num / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formata moeda BRL.
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

