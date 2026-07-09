import { describe, it, expect } from "vitest";
import { formatBytes, generateSecureString } from "@/lib/utils";

describe("Utils Library", () => {
  describe("formatBytes", () => {
    it("should format 0 bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("should format KB correctly", () => {
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
    });

    it("should format MB correctly", () => {
      expect(formatBytes(1048576)).toBe("1 MB");
      expect(formatBytes(1572864)).toBe("1.5 MB");
    });

    it("should format GB correctly", () => {
      expect(formatBytes(1073741824)).toBe("1 GB");
      expect(formatBytes(5368709120)).toBe("5 GB");
    });

    it("should work with BigInt", () => {
      expect(formatBytes(BigInt(1073741824))).toBe("1 GB");
    });
  });

  describe("generateSecureString", () => {
    it("should generate a string of the specified length", () => {
      const str1 = generateSecureString(10);
      const str2 = generateSecureString(20);
      
      expect(str1.length).toBe(10);
      expect(str2.length).toBe(20);
    });

    it("should generate random strings", () => {
      const str1 = generateSecureString(16);
      const str2 = generateSecureString(16);
      
      expect(str1).not.toBe(str2);
    });
  });
});
