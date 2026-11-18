import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect, type Page } from "@playwright/test";

export async function checkBrowser(base: string, email: string, otherEmail: string, password: string, adminToken: string) {
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  try {
    async function login(address: string) {
      const page = await browser.newPage();
      page.setDefaultTimeout(60000);
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
      await expect(async () => {
        await page.locator("#login-email").fill(address);
        await page.locator("#login-password").fill(password);
        await expect(page.locator("#login-submit")).toBeEnabled({ timeout: 2000 });
      }).toPass({ timeout: 60000 });
      await page.locator("#login-submit").click();
      await page.waitForURL(base + "/dashboard");
      return page;
    }

    async function expectMinerHidden(page: Page) {
      for (const path of ["/dashboard", "/dashboard/proxies", "/dashboard/billing"]) {
        await page.goto(base + path);
        await expect(page.locator("a[href='/dashboard/miner']")).toHaveCount(0);
        await expect(page.getByText(/Pontos Miner|Baixar APK HiveMiner/)).toHaveCount(0);
        if (path === "/dashboard/proxies") {
          await page.getByRole("button", { name: "Vincular App (QR Code)" }).click();
          await expect(page.getByText("Baixar APK HiveNode (Proxy)", { exact: false })).toBeVisible();
          await expect(page.getByText("Baixar APK HiveMiner", { exact: false })).toHaveCount(0);
        }
      }
      const response = await page.goto(base + "/dashboard/miner");
      assert.equal(response?.status(), 404);
      assert.equal((await page.request.get(base + "/api/auth/qr-link?type=miner")).status(), 404);
    }

    const page = await login(email);
    const other = await login(otherEmail);
    await other.setViewportSize({ width: 390, height: 844 });
    await expectMinerHidden(page);
    await expectMinerHidden(other);

    const admin = await browser.newContext();
    await admin.addCookies([{ name: "hivenode-token", value: adminToken, url: base }]);
    const adminPage = await admin.newPage();
    adminPage.on("pageerror", error => errors.push(error.message));
    adminPage.setDefaultTimeout(60000);
    await adminPage.goto(base + "/dashboard/admin/users");
    await adminPage.getByRole("button", { name: `Editar ${email}`, exact: true }).click();
    await adminPage.getByRole("button", { name: "Liberar acesso", exact: true }).click();
    await expect(adminPage.getByText("Acesso liberado", { exact: true })).toBeVisible();

    await page.goto(base + "/dashboard");
    await expect(page.getByRole("link", { name: "HiveMiner", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("link", { name: "HiveMiner", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(base + "/dashboard/miner", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "HiveMiner", exact: true }).waitFor();
    await page.getByRole("button", { name: "Conectar Aparelho", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await expect(page.getByRole("link", { name: /APK HiveMiner/ })).toBeVisible();
    assert.equal(await page.locator("button button").count(), 0, "nested dialog buttons");
    await page.goto(base + "/saas", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Compartilhar acesso B2B" }).waitFor();
    await expectMinerHidden(other);
    const pendingQr = await page.request.get(base + "/api/auth/qr-link?type=miner");
    const { data: { linkToken } } = await pendingQr.json();
    await adminPage.getByRole("button", { name: "Revogar acesso", exact: true }).click();
    await expect(adminPage.getByText("Acesso desativado", { exact: true })).toBeVisible();
    await expectMinerHidden(page);
    assert.equal((await page.request.post(base + "/api/auth/qr-login", { data: { linkToken } })).status(), 404);
    console.log("Browser: Miner hidden by default, grant isolated to the selected account, and revocation enforced");

    await page.goto(base + "/beta");
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page.getByRole("button", { name: "Enviar inscrição" }).click();
    await expect(page.getByRole("status")).toContainText("Inscrição recebida");
    await page.reload();
    await expect(page.getByText("Sua conta já está inscrita.")).toBeVisible();

    const guest = await browser.newPage();
    const guestEmail = randomUUID() + "@example.com";
    await guest.goto(base + "/beta");
    await guest.getByLabel("E-mail").fill(guestEmail);
    await guest.getByLabel("Número de contato").fill("+55 (11) 99999-9999");
    await guest.getByRole("button", { name: "Enviar inscrição" }).click();
    await expect(guest.getByRole("status")).toContainText("Inscrição recebida");
    await adminPage.goto(base + "/dashboard/admin/beta");
    await expect(adminPage.getByRole("row").filter({ hasText: email })).toContainText("Conta vinculada");
    await expect(adminPage.getByRole("row").filter({ hasText: guestEmail })).toContainText("+5511999999999");
    await other.goto(base + "/dashboard/admin/beta");
    await other.waitForURL(base + "/dashboard");
    console.log("Browser: linked and guest applications persisted and visible to administrators only");
    assert.deepEqual(errors, [], "browser runtime errors");
  } catch (error) {
    console.error("Browser runtime diagnostics:", errors);
    for (const context of browser.contexts()) for (const page of context.pages()) console.error("Page:", page.url(), (await page.locator("body").innerText().catch(() => "")).slice(0, 2000));
    throw error;
  } finally { await browser.close(); }
}
