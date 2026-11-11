/* Run with PLAYWRIGHT_MODULE pointing at an installed Playwright package. No dependency install is needed. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.CHECK_ORIGIN || "http://localhost:4002";
const output = path.join(process.cwd(), "docs/qa/booking");
fs.mkdirSync(output, { recursive: true });
const report = {
  origin,
  checks: [],
  errors: [],
  toolingWarnings: [],
  responsive: [],
};
const reportName = process.env.CHECK_REPORT_NAME || "browser-results.json";
function recordError(message) {
  if (message.includes("__nextjs_original-stack-frames"))
    report.toolingWarnings.push(message);
  else report.errors.push(message);
}
function pass(message) {
  console.log("PASS " + message);
  report.checks.push(message);
}
async function until(fn, message) {
  for (let i = 0; i < 60; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(message);
}
async function go(page, route) {
  await page.goto(origin + route, { waitUntil: "networkidle" });
  await page.locator(".adm-header").waitFor();
}
async function read(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("dpauto.booking-ui.v1") || "null"),
  );
}
async function confirm(page, label) {
  const modal = page.locator("dialog[open]").last();
  await modal.getByRole("button", { name: label, exact: true }).click();
}

async function workflows(browser, name) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Ho_Chi_Minh",
    reducedMotion: "reduce",
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => recordError(name + ": " + e.message));
  // HTTP addresses on real phones may not expose crypto.randomUUID.
  await page.addInitScript(() => {
    try {
      Object.defineProperty(Crypto.prototype, "randomUUID", {
        value: undefined,
        configurable: true,
      });
    } catch {}
  });
  await go(page, "/co-van/lich-hen");
  await until(
    async () => (await page.locator(".adm-booking-card").count()) === 6,
    "Initial list missing",
  );
  assert.equal(await page.locator(".site-header,.site-footer").count(), 0);
  const today = (await page
    .getByRole("textbox", { name: "Chọn ngày xem lịch" })
    .count())
    ? await page
        .getByRole("textbox", { name: "Chọn ngày xem lịch" })
        .inputValue()
    : await page.locator(".adm-date-picker input").inputValue();
  const tomorrow = await page.evaluate((d) => {
    const x = new Date(d + "T12:00:00");
    x.setDate(x.getDate() + 1);
    return (
      x.getFullYear() +
      "-" +
      String(x.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(x.getDate()).padStart(2, "0")
    );
  }, today);
  await page.getByLabel("Tìm lịch hẹn", { exact: true }).fill("nguyen van an");
  await until(
    async () => (await page.locator(".adm-booking-card").count()) === 1,
    "Search failed",
  );
  await page.getByLabel("Xóa tìm kiếm", { exact: true }).click();
  await until(
    async () => (await page.locator(".adm-booking-card").count()) === 6,
    "Search reset failed",
  );
  await page
    .locator(".adm-quick-filters")
    .getByRole("button", { name: "Chờ xác nhận", exact: true })
    .click();
  await until(
    async () => (await page.locator(".adm-booking-card").count()) === 2,
    "Status filter failed",
  );
  await page
    .locator(".adm-quick-filters")
    .getByRole("button", { name: "Tất cả", exact: true })
    .click();
  await page.getByLabel("Bộ lọc mở rộng", { exact: true }).click();
  await page.getByLabel("Lọc dịch vụ", { exact: true }).selectOption("wash");
  await until(
    async () => (await page.locator(".adm-booking-card").count()) === 1,
    "Service filter failed",
  );
  await page.getByRole("button", { name: "Xóa lọc", exact: true }).click();
  await until(
    async () => (await page.locator(".adm-booking-card").count()) === 6,
    "Filter reset failed",
  );
  await page.getByRole("button", { name: "Tuần", exact: true }).click();
  await until(
    async () => (await page.locator(".adm-date-strip button").count()) === 7,
    "Week view failed",
  );
  await page.locator(".adm-date-picker input").fill(tomorrow);
  await until(
    async () => (await page.locator(".adm-booking-card").count()) === 3,
    "Date select failed",
  );
  await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
  await until(
    async () => (await page.locator(".adm-booking-card").count()) === 6,
    "Today reset failed",
  );
  pass(name + " search, filters, day/week and date selection");
  const card = (id) =>
    page.locator(".adm-booking-card").filter({ hasText: id });
  await card("DP-0001")
    .getByRole("button", { name: "Xác nhận lịch", exact: true })
    .click();
  await confirm(page, "Xác nhận lịch");
  await until(
    async () =>
      (await read(page))?.bookings.find((b) => b.id === "DP-0001").status ===
      "confirmed",
    "Confirm state failed",
  );
  await card("DP-0001")
    .getByRole("button", { name: "Tiếp nhận xe", exact: true })
    .click();
  await confirm(page, "Tiếp nhận xe");
  await card("DP-0001")
    .getByRole("button", { name: "Hoàn thành", exact: true })
    .click();
  await confirm(page, "Hoàn thành");
  await until(
    async () =>
      (await read(page)).bookings.find((b) => b.id === "DP-0001").status ===
      "completed",
    "Complete state failed",
  );
  await page
    .locator(".adm-bottom-nav")
    .getByRole("link", { name: "Tổng quan", exact: true })
    .click();
  await until(
    async () =>
      (await page.locator(".adm-kpi-pending strong").textContent()) === "1",
    "Dashboard KPI did not update",
  );
  pass(name + " pending → confirmed → arrived → completed and shared KPIs");
  await go(page, "/co-van/lich-hen/DP-0002");
  await page
    .locator(".adm-detail")
    .getByRole("button", { name: "Đổi lịch", exact: true })
    .click();
  let modal = page.locator("dialog[open]");
  await modal.getByLabel("Ngày mới").fill(tomorrow);
  await modal.getByLabel("Giờ mới").fill("13:30");
  await modal.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await confirm(page, "Đổi lịch");
  await until(
    async () =>
      (await read(page)).bookings.find((b) => b.id === "DP-0002")
        .confirmedAt ===
      tomorrow + "T13:30:00",
    "Reschedule failed",
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".adm-detail").waitFor();
  assert.match(await page.locator(".adm-detail").innerText(), /13:30/);
  assert.match(await page.locator(".adm-timeline").innerText(), /Đổi lịch hẹn/);
  await page
    .locator(".adm-detail")
    .getByRole("link", { name: "Sửa thông tin", exact: true })
    .click();
  await page
    .getByLabel("Ghi chú nội bộ", { exact: true })
    .fill("Kiểm tra cập nhật ghi chú demo");
  await page
    .getByRole("button", { name: "Lưu thay đổi demo", exact: true })
    .click();
  await until(
    async () =>
      (await read(page)).bookings
        .find((b) => b.id === "DP-0002")
        .internalNote.includes("Kiểm tra cập nhật"),
    "Edit failed",
  );
  await page.waitForURL(
    (url) => url.pathname.endsWith("/DP-0002") && !url.searchParams.has("edit"),
  );
  await page.locator(".adm-detail").waitFor();
  pass(
    name + " reschedule, edit, timeline and direct-link refresh persistence",
  );
  await go(page, "/co-van/lich-hen/DP-0005");
  await page
    .locator(".adm-detail")
    .getByRole("button", { name: "Hủy lịch", exact: true })
    .click();
  await confirm(page, "Hủy lịch");
  await until(
    async () =>
      (await read(page)).bookings.find((b) => b.id === "DP-0005").status ===
      "cancelled",
    "Cancel failed",
  );
  assert.equal(
    await page
      .locator(".adm-detail")
      .getByRole("link", { name: "Sửa thông tin", exact: true })
      .count(),
    0,
  );
  await go(page, "/co-van/lich-hen/tao-moi");
  await page
    .getByRole("button", { name: "Tạo lịch hẹn demo", exact: true })
    .click();
  assert.ok((await page.locator(".adm-error-text").count()) >= 3);
  await page.getByLabel("Họ và tên *", { exact: true }).fill("Khách Kiểm Thử");
  await page.getByLabel("Số điện thoại *", { exact: true }).fill("0900000099");
  await page.getByLabel("Dòng xe *", { exact: true }).fill("Toyota Demo");
  await page
    .getByLabel("Biển số (không bắt buộc)", { exact: true })
    .fill("DEMO-099");
  await page.locator(".adm-service-options input").first().check();
  await page.getByLabel("Giờ mong muốn *", { exact: true }).fill("00:01");
  await page
    .getByRole("button", { name: "Tạo lịch hẹn demo", exact: true })
    .click();
  await page.waitForURL(/\/co-van\/lich-hen\/DP-/);
  const createdId = new URL(page.url()).pathname.split("/").at(-1);
  await page
    .locator(".adm-detail")
    .getByRole("button", { name: "Xác nhận lịch", exact: true })
    .click();
  await confirm(page, "Xác nhận lịch");
  await page
    .locator(".adm-detail")
    .getByRole("button", { name: "Không đến", exact: true })
    .click();
  await confirm(page, "Không đến");
  await until(
    async () =>
      (await read(page)).bookings.find((b) => b.id === createdId).status ===
      "no_show",
    "No show failed",
  );
  pass(
    name +
      " form validation, create on HTTP-compatible identifiers, cancel and no-show",
  );
  await go(page, "/co-van/khach-hang");
  await page
    .getByLabel("Tìm khách hàng", { exact: true })
    .fill("Khách Kiểm Thử");
  await until(
    async () => (await page.locator(".adm-customer-card").count()) === 1,
    "Derived customer missing",
  );
  await page.locator(".adm-customer-card").first().click();
  await page
    .locator(".adm-detail")
    .getByRole("link", { name: "Tạo lịch hẹn cho khách này", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Họ và tên *", { exact: true }).inputValue(),
    "Khách Kiểm Thử",
  );
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await page
    .locator(".adm-bottom-nav")
    .getByRole("link", { name: "Tài khoản", exact: true })
    .click();
  await page.getByRole("link", { name: /Tùy chọn cá nhân Giao diện/ }).click();
  assert.equal(
    await page.locator('.adm-sidebar a[href="/co-van/website"]').count(),
    0,
  );
  await page.getByLabel("Chuyển sang chế độ sáng", { exact: true }).click();
  assert.equal(
    await page.locator(".adm-app").getAttribute("data-theme"),
    "light",
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".adm-header").waitFor();
  assert.equal(
    await page.locator(".adm-app").getAttribute("data-theme"),
    "light",
  );
  pass(
    name +
      " customer relations, create from customer, account menu and persistent light theme",
  );
  await go(page, "/co-van/tuy-chon");
  const capacityBefore = (await read(page)).capacity;
  await page.getByRole("switch", { name: /Chế độ sáng/ }).uncheck();
  assert.equal(
    await page.locator(".adm-app").getAttribute("data-theme"),
    "dark",
  );
  assert.deepEqual((await read(page)).capacity, capacityBefore);
  await go(page, "/co-van/website");
  assert.equal(new URL(page.url()).pathname, "/co-van");
  await go(page, "/co-van/lich-hen/unknown");
  await page.getByText("Không tìm thấy lịch hẹn", { exact: true }).waitFor();
  await go(page, "/co-van/khach-hang/unknown");
  await page.getByText("Không tìm thấy khách hàng", { exact: true }).waitFor();
  await go(page, "/co-van/lich-hen?q=not-a-customer");
  await page.getByText("Chưa có lịch hẹn", { exact: true }).waitFor();
  pass(
    name +
      " personal settings, retired website redirect, empty and not-found states",
  );
  await context.close();
}

async function responsive(browser) {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const p = await context.newPage();
  p.on("pageerror", (e) => recordError(e.message));
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    await p.setViewportSize({ width, height });
    for (const route of [
      "/co-van",
      "/co-van/lich-hen",
      "/co-van/khach-hang",
      "/co-van/website",
      "/co-van/tuy-chon",
      "/co-van/lich-hen/tao-moi",
    ]) {
      await go(p, route);
      const result = await p.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        bottomNav: getComputedStyle(document.querySelector(".adm-bottom-nav"))
          .display,
        detail: document.querySelector(".adm-detail-pane")
          ? getComputedStyle(document.querySelector(".adm-detail-pane")).display
          : null,
      }));
      assert.equal(result.overflow, false, `Overflow ${route} ${width}`);
      assert.equal(result.bottomNav === "none", width >= 768);
      if (
        width >= 768 &&
        ["/co-van", "/co-van/lich-hen", "/co-van/khach-hang"].includes(route)
      )
        assert.equal(result.detail, "block");
      report.responsive.push({ route, width, height, ...result });
      if (
        [390, 768, 1440].includes(width) &&
        !route.includes("cai-dat") &&
        !route.includes("tao-moi")
      )
        await p.screenshot({
          path: path.join(
            output,
            route.slice(1).replaceAll("/", "-") + `-${width}-dark.png`,
          ),
        });
    }
    await go(p, "/co-van/lich-hen");
    if (width < 768) {
      await p.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      const last = await p.locator(".adm-booking-card").last().boundingBox(),
        nav = await p.locator(".adm-bottom-nav").boundingBox();
      assert.ok(
        last.y + last.height <= nav.y,
        `Bottom nav covers last card ${width}`,
      );
    }
    if (width === 768) {
      await p
        .locator(".adm-booking-card")
        .filter({ hasText: "DP-0002" })
        .getByRole("link", { name: "Chi tiết", exact: true })
        .click();
      await until(
        async () =>
          (await p.locator(".adm-detail-title").textContent()).includes(
            "DP-0002",
          ),
        "Master/detail selection failed",
      );
      await p.goBack();
    }
    if (width === 1440) {
      await p
        .getByRole("button", { name: "Thu gọn sidebar", exact: true })
        .click();
      assert.match(
        await p.locator(".adm-app").getAttribute("class"),
        /adm-collapsed/,
      );
      await p
        .getByRole("button", { name: "Mở rộng sidebar", exact: true })
        .click();
    }
    await p.getByLabel("Chuyển sang chế độ sáng", { exact: true }).click();
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({
      path: path.join(output, `quanly-lich-hen-${width}-light.png`),
    });
    await p.getByLabel("Chuyển sang chế độ tối", { exact: true }).click();
  }
  pass(
    "Responsive at 360 / 390 / 768 / 1024 / 1440, light/dark, bottom nav clearance and tablet selection",
  );
  for (const route of [
    "/",
    "/services",
    "/news",
    "/about",
    "/contact",
    "/services/ceramic-coating",
    "/news/ppf-vs-ceramic-coating",
    "/does-not-exist",
  ]) {
    const response = await p.goto(origin + route, { waitUntil: "networkidle" });
    assert.equal(response.status(), route === "/does-not-exist" ? 404 : 200);
    assert.equal(await p.locator(".site-header").count(), 1);
    assert.equal(await p.locator(".site-footer").count(), 1);
    assert.equal(await p.locator(".adm-app").count(), 0);
  }
  pass("Public pages retain header/footer and routes after layout separation");
  await context.close();
}
(async () => {
  for (const engine of (process.env.CHECK_ENGINES || "chromium,webkit").split(
    ",",
  )) {
    const browser = await playwright[engine].launch({ headless: true });
    try {
      await workflows(browser, engine === "webkit" ? "WebKit" : "Chromium");
      if (engine === "chromium" && !process.env.CHECK_WORKFLOW_ONLY)
        await responsive(browser);
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(report.errors, []);
  fs.writeFileSync(
    path.join(output, reportName),
    JSON.stringify(report, null, 2),
  );
  console.log("All booking browser checks passed.");
})().catch((error) => {
  report.failure = error.stack;
  fs.writeFileSync(
    path.join(output, reportName),
    JSON.stringify(report, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
});
