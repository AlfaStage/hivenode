// ==============================================================================
// Auth Helpers — JWT + Bcrypt
// ==============================================================================
// Funções utilitárias para autenticação: hashing de senhas e tokens JWT.
// ==============================================================================

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcryptjs from "bcryptjs";
import { cookies, headers } from "next/headers";

// ==============================================================================
// Tipos
// ==============================================================================

export interface TokenPayload extends JWTPayload {
  userId: string;
  role: string;
}

// ==============================================================================
// Password Hashing (bcrypt)
// ==============================================================================

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

// ==============================================================================
// JWT Token Management
// ==============================================================================

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function generateToken(
  userId: string,
  role: string
): Promise<string> {
  const token = await new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());

  return token;
}

export async function generateQrLinkToken(userId: string): Promise<string> {
  const token = await new SignJWT({ userId, type: "qr_link" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m") // Expira super rápido
    .sign(getJwtSecret());

  return token;
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as TokenPayload;
}

// ==============================================================================
// Cookie Management (Server-side)
// ==============================================================================

const TOKEN_COOKIE_NAME = "hivenode-token";

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    path: "/",
  });
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE_NAME)?.value;
}

export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
}

// ==============================================================================
// Auth Middleware Helper
// ==============================================================================

export async function getAuthenticatedUser(): Promise<TokenPayload | null> {
  try {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return await verifyToken(authHeader.split(" ")[1]);
    }

    const token = await getAuthCookie();
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<TokenPayload> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin(): Promise<TokenPayload> {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return user;
}
