import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect, type Page } from "@playwright/test";

export async function checkBrowser(base: string, email: string, otherEmail: string, password: string, adminToken: string,
  deviceTokens?: { admittedDevice: string; otherDevice: string; adminDevice: string }) {
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
      const dismissConsent = page.getByRole("button", { name: "Recusar", exact: true });
      if (await dismissConsent.isVisible()) await dismissConsent.click();
      return page;
    }

    async function expectMinerHidden(page: Page) {
      for (const path of ["/dashboard", "/dashboard/proxies", "/dashboard/billing"]) {
        await page.goto(base + path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("a[href='/dashboard/miner']")).toHaveCount(0);
        await expect(page.getByText(/Pontos Miner|Baixar APK HiveMiner/)).toHaveCount(0);
        if (path === "/dashboard/proxies") {
          await page.getByRole("button", { name: "Vincular App (QR Code)" }).click();
          await expect(page.getByText("Baixar APK HiveNode (Proxy)", { exact: false })).toBeVisible();
          await expect(page.getByText("Baixar APK HiveMiner", { exact: false })).toHaveCount(0);
        }
      }
      const response = await page.goto(base + "/dashboard/miner", { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 404);
      assert.equal(await page.evaluate(async () => (await fetch("/api/auth/qr-link?type=miner")).status), 404);
    }

    const page = await login(email);
    const other = await login(otherEmail);
    await other.setViewportSize({ width: 390, height: 844 });
    const admin = await browser.newContext();
    await admin.addCookies([{ name: "hivenode-token", value: adminToken, url: base }]);
    const adminPage = await admin.newPage();
    adminPage.on("pageerror", error => errors.push(error.message));
    adminPage.setDefaultTimeout(60000);
    await adminPage.goto(base + "/dashboard/admin/users");
    await adminPage.getByRole("button", { name: `Editar ${email}`, exact: true }).click();
    async function checkSmsBeta() {
      const smsPath = base + "/dashboard/sms";
      const mobileAccess = base + "/api/sms/mobile-access";
      const deviceAuth = (token: string) => ({ authorization: "Bearer " + token });
      const readMobileAccess = (token: string) => page.request.get(mobileAccess, { headers: deviceAuth(token) });
      assert.equal((await page.request.get(mobileAccess)).status(), 401);
      if (deviceTokens) {
        assert.deepEqual((await (await readMobileAccess(deviceTokens.admittedDevice)).json()).data, { allowed: false });
        assert.equal((await (await readMobileAccess(deviceTokens.adminDevice)).json()).data.allowed, true);
        assert.equal((await page.request.get(base + "/api/sms/pilot/admin", { headers: deviceAuth(deviceTokens.adminDevice) })).status(), 403);
      }
      await expect(page.locator("a[href='/dashboard/sms']")).toHaveCount(0);
      assert.equal((await page.goto(smsPath, { waitUntil: "domcontentloaded" }))?.status(), 404);
      await adminPage.getByRole("button", { name: "Liberar SMS", exact: true }).click();
      await expect(adminPage.getByRole("button", { name: "Revogar SMS", exact: true })).toBeVisible({ timeout: 15000 });
      await page.goto(smsPath, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "HiveNode SMS Beta" })).toBeVisible();
      await page.getByRole("button", { name: "Gerar código de vínculo" }).click();
      const pairingCode = page.getByLabel("Código de vínculo");
      await expect(pairingCode).toHaveValue(/^smsp_[a-f0-9]{64}$/);
      await expect(page.getByText("Nenhum envio real registrado.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Colocar na fila de envio" })).toHaveCount(0);

      const pilotApi = base + "/api/sms/pilot";
      const agentApi = base + "/api/sms/agent";
      const pairing = { action: "pair", code: await pairingCode.inputValue(), label: "Aparelho de teste do navegador" };
      if (deviceTokens) {
        assert.equal((await page.request.post(agentApi, { data: pairing, headers: deviceAuth(deviceTokens.otherDevice) })).status(), 404);
      }
      const paired = await page.request.post(agentApi, { data: pairing,
        headers: deviceTokens ? deviceAuth(deviceTokens.admittedDevice) : undefined });
      assert.equal(paired.status(), 201);
      const { data: { id: deviceId, token } } = await paired.json();
      if (deviceTokens) {
        const { data: access } = await (await readMobileAccess(deviceTokens.admittedDevice)).json();
        assert.equal(access.allowed, true);
        assert.equal(access.pairedDeviceId, deviceId);
        assert.deepEqual((await (await readMobileAccess(deviceTokens.otherDevice)).json()).data, { allowed: false });
      }
      const bindingId = randomUUID();
      const consentVersion = "pilot-br-1";
      const poll = { action: "poll", bindings: [{ id: bindingId, slot: 0, label: "Chip de teste" }],
        activeBinding: bindingId, consentVersion };
      const agentAuth = { authorization: "Bearer " + token };
      assert.equal((await page.request.post(agentApi, { data: poll, headers: agentAuth })).status(), 200);
      const ownerReview = await page.evaluate(async data => {
        const response = await fetch("/api/sms/pilot", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
        });
        return response.status;
      }, { action: "request-approval", deviceId, bindingId, consentVersion, verifiedByOwner: true, destination: "+5562999999999" });
      assert.equal(ownerReview, 201);
      const adminAuth = { authorization: "Bearer " + adminToken, origin: base };
      const reviews = await adminPage.request.get(pilotApi + "/admin", { headers: adminAuth });
      assert.equal(reviews.status(), 200);
      const { data: { pending } } = await reviews.json();
      const review = pending.find((item: { id: string }) => item.id === deviceId);
      assert.ok(review);
      const approved = await adminPage.request.post(pilotApi + "/admin", { headers: adminAuth, data: {
        action: "approve", deviceId, bindingId, approvalToken: review.approvalToken, carrierReviewed: true,
      } });
      assert.equal(approved.status(), 200);
      assert.equal((await page.request.post(agentApi, { data: { action: "pause" }, headers: agentAuth })).status(), 200);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByLabel("Número de teste com DDI").fill("+55 (62) 99999-9999");
      await page.getByLabel("Mensagem", { exact: true }).fill("Teste isolado do formulário");
      const sendButton = page.getByRole("button", { name: "Colocar na fila de envio" });
      const sendResult = page.getByRole("status", { name: "Resultado do envio" });
      const nextSend = () => page.waitForResponse(response => response.url() === pilotApi + "/messages" && response.request().method() === "POST");
      const [pausedResponse] = await Promise.all([nextSend(), sendButton.click()]);
      assert.equal(pausedResponse.status(), 409);
      await expect(sendResult).toContainText("selecione o SIM aprovado");
      assert.equal((await page.request.post(agentApi, { data: poll, headers: agentAuth })).status(), 200);
      const [sentResponse] = await Promise.all([nextSend(), sendButton.click()]);
      assert.equal(sentResponse.status(), 202);
      const { data: { message } } = await sentResponse.json();
      await expect(sendResult).toContainText("Mensagem na fila.");
      await expect(page.getByText(message.id, { exact: true })).toBeVisible();

      const secondNumber = "+5562988888888";
      await page.getByRole("button", { name: "Adicionar número", exact: true }).click();
      await page.getByLabel("Número a aprovar com DDI").fill(secondNumber);
      await page.getByRole("checkbox", { name: /Confirmo que tenho autorização/ }).check();
      const [secondReview] = await Promise.all([
        page.waitForResponse(response => response.url() === pilotApi && response.request().method() === "POST"),
        page.getByRole("button", { name: "Solicitar aprovação" }).click(),
      ]);
      assert.equal(secondReview.status(), 201);
      await expect(page.getByText(/8888 está em revisão/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Revogar destino +55 •••• 9999" })).toBeVisible();
      await page.getByLabel("Número de teste com DDI").fill(secondNumber);
      await page.getByLabel("Mensagem", { exact: true }).fill("Segundo destino isolado");
      const [pendingResponse] = await Promise.all([nextSend(), sendButton.click()]);
      assert.equal(pendingResponse.status(), 403);

      const adminSmsPage = await admin.newPage();
      await adminSmsPage.goto(smsPath, { waitUntil: "domcontentloaded" });
      const reviewCard = adminSmsPage.getByText(email, { exact: true }).locator("..").locator("..");
      await reviewCard.getByRole("checkbox").check();
      await reviewCard.getByRole("button", { name: "Aprovar número", exact: true }).click();
      await expect(page.getByRole("button", { name: "Revogar destino +55 •••• 8888" })).toBeVisible({ timeout: 15000 });
      await adminSmsPage.close();
      const [secondResponse] = await Promise.all([nextSend(), sendButton.click()]);
      assert.equal(secondResponse.status(), 202);
      const { data: { message: secondMessage } } = await secondResponse.json();
      await expect(page.getByRole("button", { name: "Gerar chave" })).toHaveCount(0);
      await page.getByRole("button", { name: "Gerenciar", exact: true }).click();
      await expect(page.getByRole("button", { name: "Gerar chave" })).toBeVisible();
      await page.getByRole("button", { name: "Ocultar", exact: true }).click();
      if (process.argv.includes("--sms-beta-only")) await page.screenshot({ path: ".next/sms-beta-desktop.png", fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(sendButton).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      if (process.argv.includes("--sms-beta-only")) await page.screenshot({ path: ".next/sms-beta-mobile.png", fullPage: true });
      const dispatch = await page.request.post(agentApi, { data: poll, headers: agentAuth });
      const { data: { grant } } = await dispatch.json();
      assert.equal(JSON.parse(Buffer.from(grant.payload, "base64url").toString()).id, message.id);
      const event = { action: "event", messageId: message.id, version: 1, total: 1, sent: 1, delivered: 0, failed: 0, code: null };
      assert.equal((await page.request.post(agentApi, { data: event, headers: agentAuth })).status(), 200);
      const secondDispatch = await page.request.post(agentApi, { data: poll, headers: agentAuth });
      const { data: { grant: secondGrant } } = await secondDispatch.json();
      const secondPayload = JSON.parse(Buffer.from(secondGrant.payload, "base64url").toString());
      assert.equal(secondPayload.id, secondMessage.id);
      assert.equal(secondPayload.to, secondNumber);
      await page.getByLabel("Mensagem", { exact: true }).fill("Aguardando na fila");
      const [secondQueuedResponse] = await Promise.all([nextSend(), sendButton.click()]);
      assert.equal(secondQueuedResponse.status(), 202);
      const { data: { message: secondQueued } } = await secondQueuedResponse.json();
      page.once("dialog", dialog => dialog.accept());
      await page.getByRole("button", { name: "Revogar destino +55 •••• 8888" }).click();
      const canceledRow = page.getByText(secondQueued.id, { exact: true }).locator("..");
      await expect(canceledRow.getByText("Cancelado", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Revogar destino +55 •••• 9999" })).toBeVisible();

      const key = await page.evaluate(async () => {
        const response = await fetch("/api/sms/pilot", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "issue-key" }),
        });
        return (await response.json()).data.token as string;
      });
      const sendWithKey = (destination: string, idempotencyKey: string) => page.request.post(pilotApi + "/messages", {
        data: { deviceId, destination, text: "Solicitação pela chave da API" },
        headers: { ...deviceAuth(key), "Idempotency-Key": idempotencyKey },
      });
      const retryKey = randomUUID();
      const firstViaApi = await sendWithKey("+5562999999999", retryKey);
      assert.equal(firstViaApi.status(), 202);
      const replay = await sendWithKey("+5562999999999", retryKey);
      assert.equal(replay.status(), 200);
      assert.equal((await replay.json()).data.message.id, (await firstViaApi.json()).data.message.id);
      assert.equal((await sendWithKey(secondNumber, randomUUID())).status(), 403);
      assert.equal((await sendWithKey("+5562999999999", randomUUID())).status(), 202);
      assert.equal((await sendWithKey("+5562999999999", randomUUID())).status(), 429);

      assert.equal((await other.goto(smsPath, { waitUntil: "domcontentloaded" }))?.status(), 404);
      await adminPage.getByRole("button", { name: "Revogar SMS", exact: true }).click();
      await expect(adminPage.getByRole("button", { name: "Liberar SMS", exact: true })).toBeVisible({ timeout: 15000 });
      if (deviceTokens) assert.deepEqual((await (await readMobileAccess(deviceTokens.admittedDevice)).json()).data, { allowed: false });
      assert.equal((await page.reload({ waitUntil: "domcontentloaded" }))?.status(), 404);
      console.log("Browser: pairing, SIM activation, two approved destinations, queued grants and individual revocation checked");
    }

    if (process.argv.includes("--sms-beta-only")) {
      await checkSmsBeta();
      assert.deepEqual(errors, [], "browser runtime errors");
      return;
    }

    await expectMinerHidden(page);
    await expectMinerHidden(other);
    await adminPage.getByRole("button", { name: "Liberar acesso", exact: true }).click();
    await expect(adminPage.getByText("Acesso liberado", { exact: true })).toBeVisible({ timeout: 15000 });

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
    const { data: { linkToken } } = await page.evaluate(async () => (await fetch("/api/auth/qr-link?type=miner")).json());
    await adminPage.getByRole("button", { name: "Revogar acesso", exact: true }).click();
    await expect(adminPage.getByText("Acesso desativado", { exact: true })).toBeVisible({ timeout: 15000 });
    await expectMinerHidden(page);
    assert.equal((await page.request.post(base + "/api/auth/qr-login", { data: { linkToken } })).status(), 404);
    console.log("Browser: Miner hidden by default, grant isolated to the selected account, and revocation enforced");

    await checkSmsBeta();

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
