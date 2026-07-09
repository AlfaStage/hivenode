// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { hashPassword, verifyPassword, generateToken, verifyToken } from "@/lib/auth";

// Mock das variáveis de ambiente
vi.stubEnv("JWT_SECRET", "super-secret-test-key-for-vitest-1234567890");

describe("Auth Library", () => {
  describe("Password Hashing", () => {
    it("should hash a password and verify it correctly", async () => {
      const password = "mySecurePassword123!";
      
      // Hashing
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      // Verifying success
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      // Verifying failure
      const isInvalid = await verifyPassword("wrongPassword!", hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe("JWT Tokens", () => {
    it("should generate a valid JWT token and verify its payload", async () => {
      const userId = "user-123";
      const role = "ADMIN";

      // Generating
      const token = await generateToken(userId, role);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Verifying
      const payload = await verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload.userId).toBe(userId);
      expect(payload.role).toBe(role);
    });

    it("should throw an error for an invalid token", async () => {
      await expect(verifyToken("invalid.token.here")).rejects.toThrow();
    });
  });
});
