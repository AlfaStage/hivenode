// @vitest-environment node
import { describe, expect, it } from "vitest";
import { nextBillingPeriod } from "./billing-period";
describe("billing period calendar boundaries", () => {
  it("clamps monthly renewal to February rather than overflowing into March", () => {
    expect(nextBillingPeriod(new Date("2026-01-31T13:14:15Z"), false).toISOString()).toBe("2026-02-28T13:14:15.000Z");
    expect(nextBillingPeriod(new Date("2028-01-31T13:14:15Z"), false).toISOString()).toBe("2028-02-29T13:14:15.000Z");
  });
  it("clamps yearly leap-day renewal and preserves the source date", () => {
    const start = new Date("2028-02-29T00:00:00Z");
    expect(nextBillingPeriod(start, true).toISOString()).toBe("2029-02-28T00:00:00.000Z");
    expect(start.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });
});
