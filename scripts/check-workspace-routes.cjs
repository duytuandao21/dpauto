/* Run against a built server; PLAYWRIGHT_MODULE can point at an existing installation. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const origin = process.env.CHECK_ORIGIN || "http://127.0.0.1:4002";
const output = path.join(process.cwd(), "docs/qa/workspace-routes");
const report = { redirects: [], browserChecks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });

async function redirects() {
  for (const [from, to] of [
    ["/quanly", "/co-van"],
    [
      "/quanly?date=2026-11-11&status=pending",
      "/co-van?date=2026-11-11&status=pending",
    ],
    [
      "/quanly/lich-hen?mode=week&source=Website",
      "/co-van/lich-hen?mode=week&source=Website",
    ],
    [
      "/quanly/lich-hen/tao-moi?customer=CU-001",
      "/co-van/lich-hen/tao-moi?customer=CU-001",
    ],
    ["/quanly/lich-hen/DP-0001?edit=1", "/co-van/lich-hen/DP-0001?edit=1"],
    ["/quanly/khach-hang/CU-001?q=An", "/co-van/khach-hang/CU-001?q=An"],
    ["/quanly/them", "/co-van/tai-khoan"],
    ["/quanly/cai-dat", "/co-van/tuy-chon"],
    ["/quanly/website", "/co-van"],
    ["/co-van/them", "/co-van/tai-khoan"],
    ["/co-van/cai-dat", "/co-van/tuy-chon"],
  ]) {
    const response = await fetch(origin + from, { redirect: "manual" });
    assert.equal(response.status, 308, from);
    const actual = new URL(response.headers.get("location"), origin);
    const expected = new URL(to, origin);
    assert.equal(actual.pathname, expected.pathname, from);
    assert.deepEqual(
      [...actual.searchParams].sort(),
      [...expected.searchParams].sort(),
      from,
    );
    report.redirects.push({ from, to, status: response.status });
  }
  console.log("PASS legacy redirects and query preservation");
}

async function workflow(browser, engine, width) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    report.errors.push(`${engine}-${width}: ${error.message}`),
  );
  async function go(route) {
    const response = await page.goto(origin + route, {
      waitUntil: "networkidle",
    });
    // WebKit can expose 304 on a repeated navigation to a cached static page.
    assert.ok(
      [200, 304].includes(response.status()),
      `${route}: ${response.status()}`,
    );
    // The existing mobile detail layout hides the list heading.
    await page.locator(".adm-main h1").waitFor({ state: "attached" });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
      route,
    );
    assert.match(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      /noindex/,
    );
    assert.equal(await page.locator('a[href^="/quanly"]').count(), 0, route);
  }

  // Future workspaces must not initialize or expose the advisor's booking data.
  for (const [route, title] of [
    ["/dieu-hanh", "Điều hành cửa hàng"],
    ["/admin", "Quản trị website"],
  ]) {
    await go(route);
    assert.equal(await page.locator("h1").innerText(), title);
    assert.equal(
      await page
        .locator(".adm-sidebar,.adm-bottom-nav,.adm-booking-card")
        .count(),
      0,
    );
    assert.equal(await page.locator(".adm-header-brand").isVisible(), true);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("dpauto.booking-ui.v1")),
      null,
    );
    await page.screenshot({
      path: path.join(output, `${engine}-${width}-${route.slice(1)}.png`),
    });
    await page
      .getByRole("button", { name: "Chuyển sang chế độ sáng", exact: true })
      .click();
    assert.equal(
      await page.locator(".adm-app").getAttribute("data-theme"),
      "light",
    );
    await page
      .getByRole("button", { name: "Chuyển sang chế độ tối", exact: true })
      .click();
  }

  await go("/co-van");
  await page.locator(".adm-kpis").waitFor();
  // Persist a mock change first: a fresh seed is only saved after a mutation.
  await go("/co-van/lich-hen/DP-0001");
  await page
    .locator(".adm-detail")
    .getByRole("button", { name: "Xác nhận lịch", exact: true })
    .click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Xác nhận lịch", exact: true })
    .click();
  await page.waitForFunction(
    () => !!localStorage.getItem("dpauto.booking-ui.v1"),
  );
  const storedBefore = await page.evaluate(() =>
    localStorage.getItem("dpauto.booking-ui.v1"),
  );
  const data = JSON.parse(storedBefore);
  assert.equal(data.bookings.length, 18);
  const bookingId = data.bookings[0].id;
  const customerId = data.customers[0].id;
  for (const route of [
    "/co-van/lich-hen",
    `/co-van/lich-hen/${bookingId}`,
    `/co-van/lich-hen/${bookingId}?edit=1`,
    "/co-van/lich-hen/tao-moi",
    "/co-van/khach-hang",
    `/co-van/khach-hang/${customerId}`,
    "/co-van/tai-khoan",
    "/co-van/tuy-chon",
  ]) {
    await go(route);
    assert.equal(new URL(page.url()).pathname, route.split("?")[0]);
  }
  await page.getByRole("switch", { name: /Chế độ sáng/ }).check();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("switch", { name: /Chế độ sáng/ }).waitFor();
  assert.equal(
    await page.getByRole("switch", { name: /Chế độ sáng/ }).isChecked(),
    true,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("dpauto.booking-ui.v1")),
    storedBefore,
  );
  await page.goto(origin + "/quanly/them?from=legacy", {
    waitUntil: "networkidle",
  });
  assert.equal(new URL(page.url()).pathname, "/co-van/tai-khoan");
  assert.equal(new URL(page.url()).searchParams.get("from"), "legacy");
  await page.screenshot({
    path: path.join(output, `${engine}-${width}-co-van.png`),
  });

  // Check navigation after saving a new booking in this isolated test context.
  await go("/co-van/lich-hen/tao-moi");
  await page
    .getByLabel("Họ và tên *", { exact: true })
    .fill("Khách Kiểm Tra Đường Dẫn");
  await page.getByLabel("Số điện thoại *", { exact: true }).fill("0900000099");
  await page.getByLabel("Dòng xe *", { exact: true }).fill("Toyota Vios");
  await page.locator(".adm-service-options input").first().check();
  const tomorrow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(Date.now() + 86400000));
  await page.getByLabel("Ngày mong muốn *", { exact: true }).fill(tomorrow);
  await page.getByLabel("Giờ mong muốn *", { exact: true }).fill("17:45");
  await page
    .getByRole("button", { name: "Tạo lịch hẹn demo", exact: true })
    .click();
  await page.waitForURL(/\/co-van\/lich-hen\/DP-/);
  await page.locator(".adm-detail").waitFor();
  assert.equal(
    JSON.parse(
      await page.evaluate(() => localStorage.getItem("dpauto.booking-ui.v1")),
    ).bookings.length,
    19,
  );
  report.browserChecks.push({ engine, width, passed: true });
  console.log(
    `PASS ${engine} ${width}: workspaces, links, retained data/theme, booking save`,
  );
  await context.close();
}

(async () => {
  await redirects();
  for (const [engine, type, widths] of [
    ["chrome", chromium, [390, 768, 1440]],
    ["webkit", webkit, [390]],
  ]) {
    const browser = await type.launch(
      engine === "chrome"
        ? { channel: "chrome", headless: true }
        : { headless: true },
    );
    try {
      for (const width of widths) await workflow(browser, engine, width);
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
