import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";

export interface TokenPayload extends JWTPayload {
  userId: string;
  role: string;
  version: number;
  type: string;
}

const issuer = "hivenode";
const cookieName = "hivenode-token";
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export async function generateToken(userId: string, role: string, _legacySecret?: string, version = 0, scope = "web") {
  return new SignJWT({ userId, role, version, type: "session", scope })
    .setProtectedHeader({ alg: "HS256" }).setIssuer(issuer).setAudience("web")
    .setJti(randomUUID()).setIssuedAt().setExpirationTime("7d").sign(secret());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], issuer, audience: "web" });
  if (payload.type !== "session" || typeof payload.userId !== "string" ||
      !["ADMIN", "CUSTOMER"].includes(String(payload.role)) || !Number.isInteger(payload.version)) {
    throw new Error("Unauthorized");
  }
  return payload as TokenPayload;
}

async function issueOneTime(userId: string, type: string, seconds: number) {
  const { prisma } = await import("./prisma");
  const id = randomUUID();
  await prisma.oneTimeToken.create({ data: { id, userId, type, expiresAt: new Date(Date.now() + seconds * 1000) } });
  return new SignJWT({ userId, type }).setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer).setAudience(type).setJti(id).setIssuedAt()
    .setExpirationTime(`${seconds}s`).sign(secret());
}
export const generateQrLinkToken = (userId: string) => issueOneTime(userId, "qr_link", 300);
export const generatePasswordResetToken = (userId: string) => issueOneTime(userId, "password_reset", 900);

export async function verifyOneTimeToken(token: string, type: string) {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], issuer, audience: type });
  if (payload.type !== type || typeof payload.userId !== "string" || !payload.jti) throw new Error("Unauthorized");
  return { userId: payload.userId, id: payload.jti };
}

export async function verifyPasswordResetToken(token: string) {
  try { return await verifyOneTimeToken(token, "password_reset"); } catch { return null; }
}

export async function setAuthCookie(token: string) {
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 604800, path: "/" });
}
export async function getAuthCookie() { return (await cookies()).get(cookieName)?.value; }
export async function removeAuthCookie() { (await cookies()).delete(cookieName); }

export async function getAuthenticatedUser(): Promise<TokenPayload | null> {
  try {
    const bearer = (await headers()).get("authorization");
    const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : await getAuthCookie();
    if (!token) return null;
    const payload = await verifyToken(token);
    const { prisma } = await import("./prisma");
    const user = await prisma.user.findUnique({ where: { id: payload.userId },
      select: { role: true, sessionVersion: true, disabled: true } });
    if (!user || user.disabled || user.sessionVersion !== payload.version) return null;
    return { ...payload, role: payload.scope === "device" ? "CUSTOMER" : user.role };
  } catch { return null; }
}
export async function requireAuth() {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Forbidden");
  return user;
}
