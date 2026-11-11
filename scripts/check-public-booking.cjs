/* Run against the existing dev server. PLAYWRIGHT_MODULE may point at an existing Playwright installation. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const origin = process.env.CHECK_ORIGIN || "http://localhost:4001";
const output = path.join(process.cwd(), "docs/qa/public-booking");
fs.mkdirSync(output, { recursive: true });
const report = { origin, checks: [], errors: [], layouts: [] };
const pass = (message) => {
  report.checks.push(message);
  console.log("PASS " + message);
};
async function waitFor(fn) {
  for (let i = 0; i < 60; i++) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for UI state");
}
async function layout(page, name) {
  const dimensions = await page.locator(".pb-dialog").evaluate((dialog) => {
    const footer = dialog.querySelector(".pb-footer").getBoundingClientRect();
    const rect = dialog.getBoundingClientRect();
    return {
      width: innerWidth,
      height: innerHeight,
      dialogWidth: rect.width,
      dialogHeight: rect.height,
      horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
      contentOverflow:
        dialog.querySelector(".pb-scroll").scrollWidth >
        dialog.querySelector(".pb-scroll").clientWidth + 1,
      footerVisible: footer.bottom <= innerHeight + 1 && footer.top >= 0,
    };
  });
  assert.equal(dimensions.horizontalOverflow, false);
  assert.equal(dimensions.contentOverflow, false);
  assert.equal(dimensions.footerVisible, true);
  report.layouts.push({ name, ...dimensions });
  await page.screenshot({ path: path.join(output, name + ".png") });
}
async function workflow(browser, engine, width) {
  const name = `${engine}-${width}`;
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 },
    timezoneId: "Asia/Ho_Chi_Minh",
    reducedMotion: "reduce",
    hasTouch: width < 810,
  });
  const page = await context.newPage();
  const writes = [];
  page.on("request", (request) => {
    if (
      request.url().startsWith(origin) &&
      !["GET", "HEAD"].includes(request.method()) &&
      !request.url().includes("__nextjs")
    )
      writes.push(request.url());
  });
  page.on("pageerror", (error) =>
    report.errors.push(`${name}: ${error.message}`),
  );
  await page.goto(origin, { waitUntil: "networkidle" });
  const storedBefore = await page.evaluate(() =>
    JSON.stringify({ ...localStorage }),
  );
  const trigger = page.getByRole("button", {
    name: "Đặt lịch hẹn",
    exact: true,
  });
  await trigger.click();
  const dialog = page.locator(".pb-dialog[open]");
  await dialog.waitFor();
  await waitFor(() =>
    dialog
      .locator("[data-step-heading]")
      .evaluate((el) => el === document.activeElement),
  );
  await layout(page, name + "-step1");
  await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  assert.equal(await dialog.locator(".pb-error").count(), 2);
  assert.equal(
    await dialog
      .locator("#pb-name")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await dialog.locator("#pb-name").fill("Nguyễn Văn An");
  await dialog.locator("#pb-phone").fill("123");
  await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  assert.equal(
    await dialog.locator("#pb-phone").getAttribute("aria-invalid"),
    "true",
  );
  await dialog.locator("#pb-phone").fill("0901 234 567");
  await dialog.locator("#pb-plate").fill("51K-123.45");
  await dialog.locator("#pb-vehicle").fill("Toyota Vios");
  await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await dialog.locator(".pb-services").waitFor();
  await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  assert.match(
    await dialog.locator("#pb-services-error").innerText(),
    /ít nhất/,
  );
  await dialog.locator('input[value="maintenance"]').check();
  await dialog.locator('input[value="oil"]').check();
  await layout(page, name + "-step2");
  await dialog.getByRole("button", { name: "Quay lại", exact: true }).click();
  await dialog.locator("#pb-name").waitFor();
  assert.equal(await dialog.locator("#pb-name").inputValue(), "Nguyễn Văn An");
  await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await dialog.locator(".pb-services").waitFor();
  assert.equal(
    await dialog.locator('input[name="services"]:checked').count(),
    2,
  );
  await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await dialog.locator(".pb-times").waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Xác nhận đặt lịch", exact: true })
      .isDisabled(),
    true,
  );
  await dialog.locator(".pb-slot").first().waitFor();
  assert.equal(
    await dialog.locator('.pb-slot[data-status="full"]').first().isDisabled(),
    true,
  );
  assert.equal(
    await dialog
      .locator('.pb-slot[data-status="unavailable"]')
      .first()
      .isDisabled(),
    true,
  );
  assert.equal(
    await dialog.locator('.pb-day[data-status="closed"]').first().isDisabled(),
    true,
  );
  assert.equal(
    await dialog.locator('.pb-day[data-status="full"]').first().isDisabled(),
    true,
  );
  await layout(page, name + "-step3");
  await dialog.locator(".pb-slot:not(:disabled)").first().waitFor();
  await dialog.locator(".pb-slot:not(:disabled)").first().click();
  await dialog.locator("#pb-note").fill("Kiểm tra phanh giúp tôi.");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Xác nhận đặt lịch", exact: true })
      .isEnabled(),
    true,
  );
  // Focus stays inside the dialog at both ends of the keyboard tab sequence.
  const close = dialog.getByRole("button", {
    name: "Đóng đặt lịch",
    exact: true,
  });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Xác nhận đặt lịch", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await close.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  await trigger.click();
  await dialog.waitFor();
  assert.equal(
    await dialog.locator("#pb-note").inputValue(),
    "Kiểm tra phanh giúp tôi.",
  );
  await dialog
    .getByRole("button", { name: "Xác nhận đặt lịch", exact: true })
    .click();
  await dialog.locator(".pb-success").waitFor();
  assert.match(
    await dialog.locator(".pb-status-badge").innerText(),
    /Chờ xác nhận/,
  );
  assert.match(
    await dialog.locator(".pb-summary").innerText(),
    /Nguyễn Văn An/,
  );
  assert.match(
    await dialog.locator("#pb-demo-notice").innerText(),
    /Chưa tạo lịch hẹn thực tế/,
  );
  await layout(page, name + "-success");
  await dialog.getByRole("button", { name: "Hoàn tất", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await trigger.click();
  await dialog.waitFor();
  await dialog.locator("#pb-name").waitFor();
  assert.equal(await dialog.locator("#pb-name").inputValue(), "");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(() => JSON.stringify({ ...localStorage })),
    storedBefore,
  );
  assert.deepEqual(writes, [], "Demo must not send any mutation request");
  pass(
    name +
      ": validation, navigation, disabled slots/days, summary/success, focus trap/restore, Escape, draft/reset, no writes",
  );
  await context.close();
}
(async () => {
  for (const [engine, type] of [
    ["chrome", chromium],
    ["webkit", webkit],
  ]) {
    const browser = await type.launch(
      engine === "chrome"
        ? { channel: "chrome", headless: true }
        : { headless: true },
    );
    try {
      for (const width of engine === "chrome" ? [390, 768, 1440] : [390])
        await workflow(browser, engine, width);
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(report.errors, []);
  fs.writeFileSync(
    path.join(output, "verification.json"),
    JSON.stringify(report, null, 2),
  );
})().catch((error) => {
  console.error(error);
  fs.writeFileSync(
    path.join(output, "verification.json"),
    JSON.stringify({ ...report, failure: String(error) }, null, 2),
  );
  process.exitCode = 1;
});
