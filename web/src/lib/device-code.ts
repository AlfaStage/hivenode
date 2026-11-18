import { z } from "zod";
export const deviceSessionSchema = z.object({
  type: z.enum(["miner", "proxy", "node"]).default("node"),
  deviceCode: z.string().regex(/^[a-f0-9]{64}$/), userCode: z.string().regex(/^[A-Z2-9]{6}$/),
  expiresAt: z.number(), status: z.enum(["pending", "approved"]), linkToken: z.string().nullable(),
});
