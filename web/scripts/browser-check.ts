import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
export async function checkBrowser(base: string, email: string, password: string, adminToken: string) {
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") console.error("Browser console:", message.text()); });
    page.on("requestfailed", request => console.error("Browser network:", request.url(), request.failure()));
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    console.log("Browser: login page ready");
    console.log("Browser scripts:", await page.evaluate(() => Array.from(document.scripts).map(script => script.src).filter(Boolean)));
    await expect(async () => {
      await page.locator("#login-email").fill(email);
      await page.locator("#login-password").fill(password);
      await expect(page.locator("#login-submit")).toBeEnabled({ timeout: 2000 });
    }).toPass({ timeout: 60000 });
    console.log("Browser: submitting login");
    await page.locator("#login-submit").click();
    await page.waitForURL(base + "/dashboard", { timeout: 60000, waitUntil: "commit" });
    await page.locator("main h1").first().waitFor();
    console.log("Browser: dashboard rendered");
    await page.goto(base + "/dashboard/miner", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "HiveMiner", exact: true }).waitFor();
    await page.getByRole("button", { name: "Conectar Aparelho", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    console.log("Browser: Miner dialog rendered");
    assert.equal(await page.locator("button button").count(), 0, "nested dialog buttons");
    await page.goto(base + "/saas", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Compartilhar acesso B2B" }).waitFor();
    const admin = await browser.newContext();
    await admin.addCookies([{ name: "hivenode-token", value: adminToken, url: base }]);
    const adminPage = await admin.newPage();
    adminPage.on("pageerror", error => errors.push(error.message));
    adminPage.setDefaultTimeout(60000);
    await adminPage.goto(base + "/dashboard/admin/users", { waitUntil: "domcontentloaded" });
    await adminPage.getByRole("heading", { name: /Usuários/ }).waitFor();
    await adminPage.getByText(email, { exact: true }).waitFor();
    assert.deepEqual(errors, [], "browser runtime errors");
  } catch (error) {
    console.error("Browser runtime diagnostics:", errors);
    for (const context of browser.contexts()) for (const page of context.pages()) console.error("Page:", page.url(), (await page.locator("body").innerText().catch(() => "")).slice(0, 2000));
    throw error;
  } finally { await browser.close(); }
}
