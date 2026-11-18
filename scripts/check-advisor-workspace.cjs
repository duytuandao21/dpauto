const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const assert = require("node:assert/strict");
const esbuild = require("../backend/node_modules/esbuild");
const { chrome } = require("./check-service-tickets.cjs");
const { fixture } = require("../tests/helpers/service-workflow-render.cjs");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "docs/qa/advisor-workspace");
const overviewCapture = process.argv.includes("--overview-capture");
const overviewLists =
  overviewCapture || process.argv.includes("--overview-lists");
const routes = [
  ["overview", "/co-van"],
  ["confirm-booking", "/co-van/lich-hen"],
  ["bookings", "/co-van/lich-hen"],
  ["customers", "/co-van/khach-hang"],
  ["tickets", "/co-van/phieu-dich-vu"],
  ["new-booking", "/co-van/lich-hen/tao-moi"],
  ["reception", "/co-van/tiep-nhan/truc-tiep"],
  ["work", "/co-van/phieu-dich-vu/visit"],
  ["quote", "/co-van/phieu-dich-vu/visit?tab=bao-gia"],
  ["payment", "/co-van/phieu-dich-vu/visit?tab=doi-soat"],
  ["vehicle", "/co-van/xe/v1"],
  ["account", "/co-van/tai-khoan"],
  ["settings", "/co-van/tuy-chon"],
  ["notifications", "/co-van/thong-bao"],
  ["history", "/co-van/lich-su"],
];
const scenes = routes
  .flatMap(([name, route]) =>
    (["bookings", "confirm-booking"].includes(name)
      ? [360, 390, 820, 1440]
      : [390, 820, 1440]
    ).map((width) => ({
      name: `${name}-${width}`,
      page: name,
      route,
      width,
    })),
  )
  .filter(
    (scene) =>
      !process.argv[2] || process.argv[2].split(",").includes(scene.name),
  );
function data(scene) {
  const f = fixture(
    scene.page === "quote"
      ? "QUOTING"
      : scene.page === "payment"
        ? "HANDOVER"
        : "IN_PROGRESS",
  );
  const visit = {
    ...f,
    customer: { ...f.customer, phone: "+84901234567" },
    vehicle: { ...f.vehicle, plate: "61K12345" },
    version: 1,
    customerId: "c1",
    vehicleId: "v1",
    origin: "WALK_IN",
    bookingId: null,
    allowedActions: ["edit_intake"],
    intake: {
      request: "Kiểm tra động cơ và bảo dưỡng định kỳ",
      odometer: 45000,
      receptionNote: "Khách chờ tại trạm",
      conditions: {
        exterior: "Bình thường",
        interior: "Bình thường",
        engine: "Cần kiểm tra",
        dashboard: "Không sáng đèn",
        tires: "Bình thường",
        operation: [],
      },
    },
    pricing: { approvedTotal: "1100000", hasOpenQuote: false },
  };
  delete visit.data;
  return {
    theme: "light",
    visit,
    workflow: f.data,
    overviewLists,
    visits:
      overviewLists && scene.page === "overview"
        ? Array.from({ length: 9 }, (_, i) => ({
            ...visit,
            id: `visit-${i}`,
            code: `DV-PRIORITY-${i}`,
            stage: i === 8 ? "IN_PROGRESS" : "QUOTING",
            receivedAt: `2026-11-${String(16 - i).padStart(2, "0")}T01:00:00Z`,
            work:
              i === 8
                ? { status: "IN_PROGRESS", dueAt: "2026-11-01T01:00:00Z" }
                : null,
          }))
        : [visit],
    session: {
      staff: { id: "advisor", name: "Trần Minh Khang", jobRole: "ADVISOR" },
      roles: ["ADVISOR"],
      permissions: [
        "visits.read",
        "visits.update",
        "quotes.read",
        "quotes.write",
        "quotes.decide",
        "work.write",
        "acceptance.record",
        "visits.handover",
      ],
    },
    notices: [
      {
        id: "notice",
        version: 1,
        title: "Có lịch hẹn mới cần xác nhận",
        createdAt: visit.receivedAt,
        subjectType: "BOOKING",
        subjectId: "DP-0001",
        readAt: null,
      },
    ],
  };
}
async function main() {
  assert.ok(scenes.length, "Unknown scenario");
  const bundle = await esbuild.build({
    entryPoints: [
      path.join(root, "tests/helpers/advisor-workspace-browser.tsx"),
    ],
    bundle: true,
    write: false,
    metafile: true,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "read-only-advisor-fixture",
        setup(build) {
          build.onResolve({ filter: /^next\/image$/ }, () => ({
            path: "image",
            namespace: "qa-image",
          }));
          build.onLoad({ filter: /.*/, namespace: "qa-image" }, () => ({
            contents:
              "import React from 'react';export default ({unoptimized,priority,fill,...props})=>React.createElement('img',props);",
            resolveDir: root,
          }));
          build.onResolve(
            {
              filter:
                /^(next\/(link|navigation)|.*\/(booking-provider|advisor-provider|auth-gate)|@\/lib\/api\/client|\.\/client)$/,
            },
            () => ({
              path: path.join(
                root,
                "tests/helpers/advisor-workspace-mocks.tsx",
              ),
            }),
          );
        },
      },
    ],
  });
  assert.ok(
    !Object.keys(bundle.metafile.inputs).some((file) =>
      file.replaceAll("\\", "/").endsWith("src/lib/api/client.ts"),
    ),
    "QA must not bundle the real API transport",
  );
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(
    path.join(os.tmpdir(), "dpauto-advisor-ui-"),
  );
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/bundle.js") {
      res.setHeader("content-type", "text/javascript");
      return res.end(bundle.outputFiles[0].contents);
    }
    if (url.pathname.startsWith("/co-van")) {
      const scene = scenes.find((s) => s.name === url.searchParams.get("qa"));
      if (!scene) return res.writeHead(404).end();
      res.setHeader("content-type", "text/html; charset=utf-8");
      return res.end(
        `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${["fonts", "globals", "admin", "advisor", "advisor-coreui", "advisor-redesign"].map((n) => `<link rel="stylesheet" href="/src/styles/${n}.css">`).join("")}</head><body class="dpauto-theme"><div id="root"></div><script>window.advisorQa=${JSON.stringify(data(scene)).replaceAll("<", "\\u003c")};window.advisorQaErrors=[];addEventListener('error',e=>advisorQaErrors.push(e.message));addEventListener('unhandledrejection',e=>advisorQaErrors.push(String(e.reason)));</script><script src="/bundle.js"></script></body></html>`,
      );
    }
    const file = path.resolve(
      root,
      "." +
        (url.pathname.startsWith("/fonts/") ||
        url.pathname.startsWith("/images/")
          ? "/public"
          : "") +
        url.pathname,
    );
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      res.setHeader(
        "content-type",
        file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".png")
            ? "image/png"
            : "font/woff2",
      );
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  let browser;
  const results = await fs
    .readFile(path.join(output, "results.json"), "utf8")
    .then(JSON.parse)
    .catch(() => ({}));
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chrome(profile);
    for (const scene of scenes) {
      const { targetId } = await browser.send("Target.createTarget", {
        url: "about:blank",
      });
      const { sessionId } = await browser.send("Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      const js = async (expression) => {
        const r = await browser.send(
          "Runtime.evaluate",
          { expression, awaitPromise: true, returnByValue: true },
          sessionId,
        );
        assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails));
        return r.result.value;
      };
      const wait = (expression) =>
        js(
          `new Promise((resolve,reject)=>{let end=Date.now()+7000;function tick(){if(${expression})resolve(true);else if(Date.now()>end)reject(Error('Fixture not ready: '+document.body.innerText+' '+JSON.stringify(advisorQaErrors)));else setTimeout(tick,30)}tick()})`,
        );
      const snap = async (suffix = "") => {
        const shot = await browser.send(
          "Page.captureScreenshot",
          { format: "png", captureBeyondViewport: false },
          sessionId,
        );
        await fs.writeFile(
          path.join(output, scene.name + suffix + ".png"),
          Buffer.from(shot.data, "base64"),
        );
      };
      try {
        await browser.send("Page.enable", {}, sessionId);
        await browser.send(
          "Page.addScriptToEvaluateOnNewDocument",
          {
            source: `window.advisorMotion = [];
            const seen = new WeakMap();
            const selector = '.adv-workspace-drawer[open], .adv-order-detail, .adv-detail-page, .adv-reception';
            new MutationObserver(() => {
              document.querySelectorAll(selector).forEach(element => {
                const kind = element.matches('dialog') ? (element.dataset.closing ? 'close' : 'drawer') : 'page';
                if (seen.get(element) === kind) return;
                seen.set(element, kind);
                const record = { kind, animation: getComputedStyle(element).animationName, frames: [] };
                advisorMotion.push(record);
                const started = performance.now();
                function sample() {
                  if (!element.isConnected) return;
                  const style = getComputedStyle(element);
                  record.frames.push({ x: new DOMMatrixReadOnly(style.transform).m41, overflow: document.documentElement.scrollWidth > innerWidth });
                  if (element.isConnected && performance.now() - started < 350) requestAnimationFrame(sample);
                }
                sample();
              });
            }).observe(document, {subtree:true,childList:true,attributes:true,attributeFilter:['open','data-closing']});`,
          },
          sessionId,
        );
        await browser.send(
          "Emulation.setDeviceMetricsOverride",
          {
            width: scene.width,
            height:
              scene.page === "confirm-booking" && scene.width < 768
                ? 740
                : 1000,
            deviceScaleFactor: 1,
            mobile: scene.width < 768,
          },
          sessionId,
        );
        const loaded = browser.event("Page.loadEventFired", sessionId);
        await browser.send(
          "Page.navigate",
          {
            url: `http://127.0.0.1:${server.address().port}${scene.route}${scene.route.includes("?") ? "&" : "?"}qa=${scene.name}`,
          },
          sessionId,
        );
        await loaded;
        await wait(
          "document.querySelector('.adm-app.adv-ui .adm-main') && !document.querySelector('.adm-skeleton')",
        );
        await js(
          "document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,300)))",
        );
        if (overviewCapture && scene.page === "overview") {
          await wait(
            "document.querySelectorAll('.adv-tasks .adv-ticket-table tbody tr').length === 5",
          );
          await js(
            "document.querySelector('.adv-tasks').scrollIntoView({block:'start'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
          );
          await snap("-service-list");
          results[scene.name] = { passed: true, captured: true };
          console.log("CAPTURE " + scene.name + " service list");
          continue;
        }
        if (scene.page === "confirm-booking") {
          await js(
            "document.querySelector('.adv-bookings-table .adm-action-confirm').click()",
          );
          await wait(
            "document.querySelector('.adv-booking-confirm-dialog[open] .adv-booking-confirm-form')",
          );
          await js(
            "document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))",
          );
          const form = await js(`(() => {
            const dialog = document.querySelector('.adv-booking-confirm-dialog[open]');
            const fields = [...dialog.querySelectorAll('.adm-booking-fields > label')];
            const actions = [...dialog.querySelectorAll('.adm-dialog-actions > button')];
            return { fits: dialog.scrollWidth <= dialog.clientWidth + 1, sameRow: Math.abs(fields[0].getBoundingClientRect().top - fields[1].getBoundingClientRect().top) < 2, actionRow: Math.abs(actions[0].getBoundingClientRect().top - actions[1].getBoundingClientRect().top) < 2, noteClosed: !dialog.querySelector('details').open, emptyTime: dialog.querySelector('input[type=time]').value === '', phone: dialog.querySelector('a[href^="tel:"]')?.getAttribute('href'), date: dialog.querySelector('.adv-date-input > input').value, name: dialog.querySelector('.adv-booking-confirm-customer strong').textContent, focus: dialog.contains(document.activeElement) };
          })()`);
          assert.equal(
            form.fits,
            true,
            "Confirmation must fit without horizontal scrolling",
          );
          assert.equal(
            form.sameRow,
            true,
            "Agreed date and time must share a row",
          );
          assert.equal(
            form.actionRow,
            true,
            "Confirmation actions must share a row",
          );
          assert.equal(form.noteClosed, true);
          assert.equal(form.emptyTime, true);
          assert.match(form.phone, /^tel:0\d+$/);
          assert.match(form.date, /^\d{2}\/\d{2}\/\d{4}$/);
          assert.ok(form.name.trim());
          assert.equal(form.focus, true);
          if (scene.width < 768) {
            const compact = await js(`(() => {
              const dialog = document.querySelector('.adv-booking-confirm-dialog[open]');
              const input = dialog.querySelector('.adv-date-input > input');
              const style = getComputedStyle(input);
              const canvas = document.createElement('canvas').getContext('2d');
              canvas.font = style.font;
              const button = dialog.querySelector('button[type=submit]');
              // Measure the border box so input padding is subtracted only once.
              const available = input.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
              return {dateFits: canvas.measureText(input.value).width <= available, buttonOneLine: button.clientHeight < 56, fitsHeight: dialog.scrollHeight <= dialog.clientHeight + 1};
            })()`);
            await snap("-form");
            assert.equal(
              compact.dateFits,
              true,
              "The full year must fit beside the date picker: " +
                JSON.stringify(compact),
            );
            assert.equal(
              compact.buttonOneLine,
              true,
              "Confirmation label must fit on one line",
            );
            assert.equal(
              compact.fitsHeight,
              true,
              "Collapsed confirmation should fit the mobile viewport",
            );
          }
          assert.equal(
            await js(
              "document.activeElement === document.querySelector('.adv-booking-confirm-dialog[open] [aria-label=\"Đóng form chốt lịch\"]')",
            ),
            true,
            "Focus should stay in the popup without opening the mobile keyboard",
          );
          await snap("-form");
          await js(
            "document.querySelector('.adv-booking-confirm-services summary').click()",
          );
          await wait(
            "document.querySelector('.adv-booking-confirm-services').open",
          );
          assert.equal(
            await js(
              "document.querySelectorAll('.adv-booking-confirm-services li').length",
            ),
            3,
          );
          await js(
            "document.querySelector('.adv-booking-confirm-notes summary').click()",
          );
          await wait(
            "document.querySelector('.adv-booking-confirm-notes').open",
          );
          await js(
            "document.querySelector('.adv-booking-confirm-dialog[open]').scrollTop = 10000",
          );
          assert.equal(
            await js(`(() => {
            const button = document.querySelector('.adv-booking-confirm-dialog[open] button[type=submit]').getBoundingClientRect();
            return button.bottom <= innerHeight && button.top >= 0;
          })()`),
            true,
            "Confirm button must remain visible after expanding and scrolling",
          );
          await js(
            "document.querySelector('.adv-booking-confirm-dialog[open] .adm-dialog-actions button[type=button]').click()",
          );
          await wait(
            "!document.querySelector('.adv-booking-confirm-dialog[open]')",
          );
        }
        const measure = await js(
          "({overflow:document.documentElement.scrollWidth>innerWidth,width:innerWidth,heading:document.querySelector('h1')?.textContent,errors:advisorQaErrors})",
        );
        await snap("");
        if (measure.overflow)
          console.log(
            await js(
              "JSON.stringify([...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth && getComputedStyle(e).position!=='fixed').map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).slice(-15))",
            ),
          );
        assert.equal(measure.overflow, false, "Page overflows horizontally");
        assert.deepEqual(measure.errors, []);
        if (["tickets", "history", "notifications"].includes(scene.page)) {
          const pagination = await js(`(() => {
            const rows = [...document.querySelectorAll('.adv-pagination, .mgr-pagination')];
            return {count: rows.length, compact: rows.every(row => {
              const buttons = [...row.querySelectorAll('button')];
              const rect = row.getBoundingClientRect();
              return buttons.length === 2 && rect.left >= 0 && rect.right <= innerWidth
                && buttons.every(button => button.getBoundingClientRect().height >= 44)
                && Math.abs(buttons[0].getBoundingClientRect().top - buttons[1].getBoundingClientRect().top) < 2;
            })};
          })()`);
          assert.equal(
            pagination.count,
            scene.page === "history" ? 2 : 1,
            "Every paginated list must retain its controls",
          );
          assert.equal(
            pagination.compact,
            true,
            "Pagination must fit and keep two accessible buttons on one row",
          );
        }
        if (scene.page === "new-booking") {
          assert.equal(
            await js(`(() => {
            const label = document.querySelector('.adm-toggle-row');
            const box = label.querySelector('input').getBoundingClientRect();
            const text = label.querySelector('span').getBoundingClientRect();
            return box.right <= text.left && text.left - box.right <= 12;
          })()`),
            true,
            "Checkbox must sit next to the left of its text",
          );
          await js(`window.fillField = (selector, value) => {
            const input = document.querySelector(selector);
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }`);
          await js(`fillField('#phone', '+84901234567')`);
          await js(
            `document.querySelector('#phone').dispatchEvent(new FocusEvent('focusout', {bubbles:true}))`,
          );
          await wait(`document.querySelector('#phone').value === '0901234567'`);
          await js(`fillField('#plate', '61k12345')`);
          await js(
            `document.querySelector('#plate').dispatchEvent(new FocusEvent('focusout', {bubbles:true}))`,
          );
          await wait(`document.querySelector('#plate').value === '61K-123.45'`);
          await js(`fillField('#date', '31/02/2030')`);
          await wait(`!document.querySelector('#date').checkValidity()`);
          await js(`fillField('#date', '16/11/2030')`);
          await wait(
            `document.querySelector('#date').checkValidity() && document.querySelector('.adv-date-picker').value === '2030-11-16'`,
          );
          await js(`fillField('.adv-date-picker', '2030-11-17')`);
          await wait(`document.querySelector('#date').value === '17/11/2030'`);
          await snap("-formats");
        }
        if (["tickets", "work"].includes(scene.page)) {
          assert.equal(
            await js(
              `document.querySelector('main').innerText.includes('61K-123.45') && document.querySelector('main').innerText.includes('0901234567') && !document.querySelector('main').innerText.includes('+84901234567')`,
            ),
            true,
            "Stored phone and plate must display in domestic format",
          );
        }
        if (overviewLists && scene.page === "overview") {
          await wait(
            "document.querySelectorAll('.adv-tasks .adv-ticket-table tbody tr').length === 5",
          );
          const lists = await js(`(() => {
            const booking = document.querySelector('#advisor-task-list');
            const service = document.querySelector('.adv-tasks');
            return {
              headings: [...document.querySelectorAll('.adm-task-heading h2')].map(e=>e.textContent.trim()),
              counts: [booking,service].map(e=>e.querySelectorAll('tbody tr').length),
              layout: [booking,service].map(e=>getComputedStyle(e.querySelector('tbody tr')).display),
              collapsed: !!service.closest('details'),
              firstBooking: booking.querySelector('.adv-booking-code').getAttribute('href'),
              firstService: service.querySelector('.adv-ticket-actions .adm-primary').getAttribute('href'),
              allLinks: [...document.querySelectorAll('.adv-overview-footer a')].map(e=>e.getAttribute('href')),
              bookingButtonsFit: [...booking.querySelectorAll('.adv-table-actions .adm-btn')].filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().height < 56),
              rows: [...document.querySelectorAll('.adm-overview tbody tr')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,overflow:[...e.querySelectorAll('.adm-btn')].some(b=>b.scrollWidth>b.clientWidth+1)};})
            };
          })()`);
          assert.deepEqual(lists.headings, [
            "Lịch cần xử lý",
            "Phiếu dịch vụ cần xử lý",
          ]);
          assert.deepEqual(lists.counts, [5, 5]);
          if (scene.width < 768)
            assert.equal(
              lists.bookingButtonsFit,
              true,
              "Booking actions must stay compact on mobile",
            );
          assert.deepEqual(
            lists.layout,
            scene.width < 768 ? ["grid", "grid"] : ["table-row", "table-row"],
          );
          assert.equal(lists.collapsed, false);
          assert.ok(lists.firstBooking.includes("booking=priority-0"));
          assert.equal(
            lists.firstService,
            "/co-van/phieu-dich-vu/visit-8?tab=thi-cong",
          );
          assert.deepEqual(lists.allLinks, [
            "/co-van/lich-hen",
            "/co-van/phieu-dich-vu",
          ]);
          assert.ok(
            lists.rows.every(
              (r) =>
                !r.overflow &&
                (scene.width === 820 ||
                  (r.left >= 0 && r.right <= scene.width)),
            ),
            JSON.stringify(lists.rows),
          );
          await snap();
          await js(
            "document.querySelector('.adv-tasks').scrollIntoView({block:'start'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
          );
          await snap("-service-list");
        }
        if (
          ["overview", "bookings", "customers"].includes(scene.page) &&
          !(overviewLists && scene.page === "overview")
        ) {
          if (scene.page === "bookings") {
            const table = await js(`(() => {
              const rows = [...document.querySelectorAll('.adv-bookings-table tbody tr')];
              return { sameRow: rows.every(row => new Set([...row.querySelectorAll('.adv-table-actions .adm-btn')].filter(b => b.getClientRects().length).map(b => Math.round(b.getBoundingClientRect().top))).size === 1), visibleServices: rows[0].querySelectorAll('.adv-booking-services > span').length, more: rows[0].querySelector('.adv-booking-services a')?.textContent.trim(), scrolls: document.querySelector('.adv-data-scroll').scrollWidth > document.querySelector('.adv-data-scroll').clientWidth + 1 };
            })()`);
            assert.equal(
              table.sameRow,
              true,
              "Booking actions must share a row",
            );
            assert.equal(table.visibleServices, 2);
            assert.equal(table.more, "+3 dịch vụ khác");
            if (scene.width === 1440 || scene.width < 768)
              assert.equal(
                table.scrolls,
                false,
                "Desktop table and mobile cards should fit their container",
              );
            if (scene.width < 768)
              assert.equal(
                await js(`(() => {
              const row = document.querySelector('.adv-bookings-table tbody tr');
              const customer = row.querySelector('.adv-booking-customer').getBoundingClientRect();
              const status = row.querySelector('.adv-booking-status').getBoundingClientRect();
              if (customer.right > status.left || Math.abs(customer.top - status.top) > 2) return false;
              return getComputedStyle(row).display === 'grid' && [...row.querySelectorAll('td')].every(cell => {
                const box = cell.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth;
              });
            })()`),
                true,
                "All booking fields and actions must be visible in each mobile card",
              );
          }
          const detailLink =
            scene.page === "overview"
              ? `[...document.querySelectorAll('.adv-table-actions a')].find(a => a.textContent.trim() === 'Chi tiết')`
              : scene.page === "bookings"
                ? `document.querySelector('.adv-booking-services a')`
                : `document.querySelector('.adv-data-table tbody td a')`;
          await js(`${detailLink}.click()`);
          await wait("document.querySelector('.adv-workspace-drawer[open]')");
          await wait(
            "advisorMotion.some(r => r.kind === 'drawer' && r.frames.length > 1 && r.frames.at(-1).x < 1)",
          );
          const motion = await js(
            "advisorMotion.find(r => r.kind === 'drawer')",
          );
          assert.equal(motion.animation, "adv-drawer-in");
          assert.ok(
            motion.frames[0].x > motion.frames.at(-1).x + 20,
            "Drawer must enter from the right",
          );
          assert.ok(
            motion.frames.every(
              (f, i) => !i || f.x <= motion.frames[i - 1].x + 1,
            ),
            "Drawer must move smoothly without bouncing",
          );
          assert.ok(
            await js(
              "document.querySelector('.adv-workspace-drawer').contains(document.activeElement)",
            ),
            "Focus must stay in drawer",
          );
          assert.ok(
            await js(
              "document.querySelector('.adv-workspace-drawer').getBoundingClientRect().right <= innerWidth",
            ),
          );
          await snap("-drawer");
          if (scene.page === "overview") {
            const buttons = await js(`(() => {
              const buttons = [...document.querySelectorAll('.adm-detail-actions .adm-btn')].filter(b => b.getClientRects().length);
              return {count: buttons.length, sameRow: new Set(buttons.map(b => Math.round(b.getBoundingClientRect().top))).size === 1, overflow: buttons.some(b => b.scrollWidth > b.clientWidth + 1)};
            })()`);
            assert.equal(buttons.count, 4);
            assert.equal(
              buttons.sameRow,
              true,
              "Booking actions must stay on one row",
            );
            assert.equal(
              buttons.overflow,
              false,
              "Booking button labels must fit their buttons",
            );
          }
          if (scene.page !== "bookings") {
            await js("document.querySelector('.adv-drawer-heading a').click()");
          } else {
            await browser.send(
              "Input.dispatchKeyEvent",
              {
                type: "keyDown",
                key: "Escape",
                code: "Escape",
                windowsVirtualKeyCode: 27,
              },
              sessionId,
            );
            await browser.send(
              "Input.dispatchKeyEvent",
              {
                type: "keyUp",
                key: "Escape",
                code: "Escape",
                windowsVirtualKeyCode: 27,
              },
              sessionId,
            );
          }
          await wait("!document.querySelector('.adv-workspace-drawer[open]')");
          const exit = await js("advisorMotion.find(r => r.kind === 'close')");
          assert.equal(exit.animation, "adv-drawer-out");
          assert.ok(
            exit.frames.at(-1).x > exit.frames[0].x + 20,
            "Drawer must leave towards the right: " +
              JSON.stringify(exit.frames),
          );
          if (scene.width === 390) {
            await browser.send(
              "Emulation.setEmulatedMedia",
              {
                features: [{ name: "prefers-reduced-motion", value: "reduce" }],
              },
              sessionId,
            );
            await js(`${detailLink}.click()`);
            await wait("document.querySelector('.adv-workspace-drawer[open]')");
            assert.equal(
              await js(
                "getComputedStyle(document.querySelector('.adv-workspace-drawer')).animationName",
              ),
              "none",
            );
            assert.equal(
              await js(
                "getComputedStyle(document.querySelector('.adv-workspace-drawer'),'::backdrop').animationName",
              ),
              "none",
            );
            await js("document.querySelector('.adv-drawer-heading a').click()");
            await wait(
              "!document.querySelector('.adv-workspace-drawer[open]')",
            );
          }
        }
        if (["work", "vehicle", "reception"].includes(scene.page)) {
          const motion = await js("advisorMotion.find(r => r.kind === 'page')");
          assert.equal(motion?.animation, "adv-detail-in");
          assert.ok(
            motion.frames[0].x > motion.frames.at(-1).x,
            "Detail page must appear from the right",
          );
          assert.ok(
            motion.frames.every((f) => !f.overflow),
            "Detail animation must not add horizontal scroll",
          );
          if (scene.width === 390) {
            await browser.send(
              "Emulation.setEmulatedMedia",
              {
                features: [{ name: "prefers-reduced-motion", value: "reduce" }],
              },
              sessionId,
            );
            assert.equal(
              await js(
                "getComputedStyle(document.querySelector('.adv-order-detail, .adv-detail-page, .adv-reception')).animationName",
              ),
              "none",
            );
          }
        }
        if (scene.name === "work-1440") {
          await js("document.querySelector('.adv-sidebar-toggle').click()");
          assert.ok(
            await js(
              "!document.querySelector('.adm-app').classList.contains('adm-collapsed')",
            ),
          );
          await snap("-expanded");
        }
        assert.deepEqual(await js("advisorQaErrors"), []);
        results[scene.name] = {
          passed: true,
          ...measure,
          motion: await js(
            "advisorMotion.map(({kind,animation,frames})=>({kind,animation,firstX:frames[0]?.x,lastX:frames.at(-1)?.x}))",
          ),
        };
        console.log("PASS " + scene.name);
      } catch (error) {
        results[scene.name] = { passed: false, error: error.message };
        console.log("FAIL " + scene.name + ": " + error.message);
      } finally {
        await browser.send("Target.closeTarget", { targetId });
      }
    }
    await fs.writeFile(
      path.join(output, "results.json"),
      JSON.stringify(results, null, 2),
    );
    assert.ok(
      scenes.every((s) => results[s.name].passed),
      "One or more advisor UI scenarios failed",
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    if (
      path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) &&
      path.basename(profile).startsWith("dpauto-advisor-ui-")
    )
      await fs.rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
