const fs = require("node:fs");
const path = require("node:path");
const origin = process.env.DPAUTO_QA_ORIGIN || "http://127.0.0.1:4002";
if (!/^http:\/\/(127\.0\.0\.1|localhost):(4002|4101)$/.test(origin))
  throw Error(
    "Use an isolated local validation server, not the user or production server.",
  );
const cdp = `http://127.0.0.1:${process.env.DPAUTO_CHROME_PORT || 60299}`;
const output = path.resolve("docs/qa/manager-audit");
fs.mkdirSync(output, { recursive: true });
const routes = (
  process.env.DPAUTO_QA_ROUTES ||
  ",lich-hen,nang-luc,nhan-su,dich-vu,khach-hang,dieu-phoi,phieu-dich-vu,bao-gia,kho,tai-chinh,canh-bao,bao-cao,cau-hinh,thong-bao,nhat-ky,website/noi-dung,website/bai-viet,website/hinh-anh,website/seo"
).split(",");
const widths = (process.env.DPAUTO_QA_WIDTHS || "1536,820,390")
  .split(",")
  .map(Number);
const previous =
  process.env.DPAUTO_QA_RESUME &&
  fs.existsSync(path.join(output, "browser-results.json"))
    ? JSON.parse(
        fs.readFileSync(path.join(output, "browser-results.json"), "utf8"),
      )
    : { results: [], errors: [] };
const results = previous.results,
  errors = previous.errors;
let current = "";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const tab = await (
    await fetch(
      `${cdp}/json/new?${encodeURIComponent(origin + "/dieu-hanh")}`,
      { method: "PUT" },
    )
  ).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let serial = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      m.error ? p.reject(m.error) : p.resolve(m.result);
    } else if (m.method === "Runtime.exceptionThrown")
      errors.push({
        route: current,
        message:
          m.params.exceptionDetails.exception?.description ||
          m.params.exceptionDetails.text,
      });
    else if (
      m.method === "Runtime.consoleAPICalled" &&
      m.params.type === "error"
    )
      errors.push({
        route: current,
        message: m.params.args
          .map((a) => a.value || a.description || "")
          .join(" "),
      });
  };
  const send = (method, params = {}, timeout = 30000) =>
    new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error(`CDP timeout: ${method}`));
      }, timeout);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description || r.exceptionDetails.text,
      );
    return r.result.value;
  };
  const wait = async (expression, timeout = 60000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await ev(expression)) return;
      await pause(150);
    }
    throw Error("Waiting failed: " + expression);
  };
  const navigate = async (route) => {
    current = route;
    await send("Page.navigate", {
      url: origin + "/dieu-hanh" + (route ? "/" + route : ""),
    });
    await wait(
      `location.pathname===${JSON.stringify("/dieu-hanh" + (route ? "/" + route.split("?")[0] : ""))}&&!!document.querySelector('.mgr-app h1')`,
    );
    await pause(200);
  };
  const check = (name, pass, detail) => {
    results.push({ name, pass: !!pass, ...(detail ? { detail } : {}) });
    if (!pass) console.log("FAIL " + name + " " + JSON.stringify(detail || ""));
  };
  const click = async (selector) => {
    await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control: '+${JSON.stringify(selector)});e.click();})()`,
    );
    await pause(160);
  };
  const button = async (text, root = "document") => {
    await ev(
      `(()=>{const e=[...${root}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing button '+${JSON.stringify(text)});e.click();})()`,
    );
    await pause(160);
  };
  const fill = async (selector, value) => {
    await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input');const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await pause(120);
  };
  const shot = async (name) => {
    await send("Page.bringToFront");
    await pause(300);
    try {
      const r = await send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false },
        8000,
      );
      fs.writeFileSync(
        path.join(output, name + ".png"),
        Buffer.from(r.data, "base64"),
      );
    } catch (e) {
      console.log("Screenshot unavailable: " + name);
    }
  };
  try {
    await send("Runtime.enable");
    await send("Page.enable");
    for (const width of widths) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      for (const route of routes) {
        if (
          results.some(
            (r) =>
              r.name === `route ${route || "dashboard"} @${width}` && r.pass,
          )
        )
          continue;
        await navigate(route);
        const metrics = await ev(
          `({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.querySelector('h1')?.textContent,notice:document.querySelectorAll('.mgr-session-notice[role=note]').length,broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.currentSrc)})`,
        );
        check(
          `route ${route || "dashboard"} @${width}`,
          metrics.scroll <= metrics.width + 2 &&
            metrics.notice === 1 &&
            metrics.broken.length === 0,
          metrics,
        );
        if (
          (width === 1536 && ["", "dieu-phoi"].includes(route)) ||
          (width === 390 && route === "phieu-dich-vu") ||
          (width === 820 && route === "nhan-su")
        )
          await shot(`${route || "dashboard"}-${width}`);
      }
      console.log(`Reviewed ${routes.length} routes at ${width}px`);
    }
    if (process.env.DPAUTO_QA_INTERACTIONS !== "0") {
      await send("Emulation.setDeviceMetricsOverride", {
        width: 1536,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await navigate("");
      const links = await ev(
        `[...document.querySelectorAll('.mgr-kpi')].every(e=>e.tagName==='A'&&e.getAttribute('href').startsWith('/dieu-hanh/'))`,
      );
      check("dashboard KPIs open filtered screens", links);
      await click('.mgr-kpi[href*="status=pending"]');
      await wait(
        `location.pathname.endsWith('/lich-hen')&&document.querySelector('select')`,
      );
      check(
        "KPI status filter is applied",
        await ev(
          `[...document.querySelectorAll('select')].some(s=>s.value==='pending')`,
        ),
      );
      await navigate("phieu-dich-vu?selected=DV-TT-0001");
      await wait(`!!document.querySelector('dialog[open]')`);
      for (const text of [
        "Báo giá",
        "Thi công",
        "Nghiệm thu",
        "Lịch sử",
        "Tổng quan",
      ]) {
        await button(text, "document.querySelector('dialog[open]')");
        check(
          "order drawer tab " + text,
          await ev(
            `!!document.querySelector('dialog[open] .mgr-detail-section')`,
          ),
        );
      }
      await fill("dialog[open] select", "MS-2");
      await ev(
        `(()=>{const selects=document.querySelectorAll('dialog[open] select');const s=selects[1];Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'MS-5');s.dispatchEvent(new Event('change',{bubbles:true}));})()`,
      );
      await fill("dialog[open] textarea", "Điều phối theo ca làm");
      await click(
        'dialog[open] button[type="submit"],dialog[open] form button.adm-primary',
      );
      await wait(`document.querySelectorAll('dialog[open]').length===2`);
      await button(
        "Cập nhật phân công",
        "[...document.querySelectorAll('dialog[open]')].at(-1)",
      );
      check(
        "advisor and technician assignment updates session",
        await ev(
          `document.querySelector('.adm-toast')?.textContent.includes('trong phiên')&&document.querySelector('dialog[open] select')?.value==='MS-2'`,
        ),
      );
      await navigate("nang-luc");
      await button("Điều chỉnh");
      await fill("dialog[open] input[type=number]", "0");
      check(
        "capacity reduction shows impact",
        await ev(
          `document.querySelector('.mgr-capacity-impact')?.textContent.includes('Thiếu')`,
        ),
      );
      await fill("dialog[open] textarea", "Thiếu nhân sự trong ca");
      await button(
        "Cập nhật năng lực",
        "document.querySelector('dialog[open]')",
      );
      await wait(`document.querySelectorAll('dialog[open]').length===2`);
      await button(
        "Cập nhật năng lực",
        "[...document.querySelectorAll('dialog[open]')].at(-1)",
      );
      check(
        "capacity updates without cancelling reservations",
        await ev(
          `document.querySelector('.mgr-capacity-card')?.textContent.includes('Vượt năng lực')`,
        ),
      );
      await navigate("lich-hen?selected=TT-0011");
      await wait(`!!document.querySelector('dialog[open]')`);
      await button("Xác nhận lịch", "document.querySelector('dialog[open]')");
      await button(
        "Kiểm tra & xác nhận",
        "document.querySelector('dialog[open]')",
      );
      check(
        "booking action requires a reason",
        await ev(`!!document.querySelector('dialog[open] [role=alert]')`),
      );
      await fill("dialog[open] textarea", "Đã gọi khách thống nhất lịch");
      await click("dialog[open] input[type=checkbox]");
      await button(
        "Kiểm tra & xác nhận",
        "document.querySelector('dialog[open]')",
      );
      await wait(`document.querySelectorAll('dialog[open]').length===2`);
      await button(
        "Xác nhận lịch",
        "[...document.querySelectorAll('dialog[open]')].at(-1)",
      );
      check(
        "pending appointment confirmation",
        await ev(
          `document.querySelector('dialog[open] .adm-badge')?.textContent.includes('Đã xác nhận')`,
        ),
      );
      await navigate("nhan-su");
      await button("Thêm ca làm");
      await fill("dialog[open] select", "MS-2");
      await fill("dialog[open] input[type=date]", "2026-12-01");
      await fill("dialog[open] textarea", "Bố trí ca hỗ trợ");
      await button("Cập nhật ca làm", "document.querySelector('dialog[open]')");
      await wait(`document.querySelectorAll('dialog[open]').length===2`);
      await button(
        "Xác nhận",
        "[...document.querySelectorAll('dialog[open]')].at(-1)",
      );
      check(
        "shift form updates session",
        await ev(
          `document.querySelector('.adm-toast')?.textContent.includes('ca làm')`,
        ),
      );
      await navigate("phieu-dich-vu");
      await fill(".mgr-search input", "NO-MATCH-999");
      check(
        "empty search state",
        await ev(
          `document.body.textContent.includes('Không có phiếu phù hợp')`,
        ),
      );
      await navigate("kho");
      await button("Phiếu nhập / xuất");
      check(
        "stock movements are linked to service orders",
        await ev(
          `document.body.textContent.includes('XK-001')&&!!document.querySelector('.mgr-line-list button')`,
        ),
      );
      await button("Nhu cầu theo phiếu");
      check(
        "remaining part demand is visible",
        await ev(`document.body.textContent.includes('Còn cần')`),
      );
      await navigate("tai-chinh");
      await click("input[type=checkbox]");
      check(
        "debt filter keeps outstanding payments",
        await ev(
          `document.querySelectorAll('tbody tr').length>0&&document.body.textContent.includes('Thu một phần')`,
        ),
      );
      await send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await navigate("");
      await click(".mgr-mobile-toggle");
      await wait(`!!document.querySelector('dialog[open] .mgr-mobile-menu')`);
      check(
        "mobile navigation opens and fits",
        await ev(`document.documentElement.scrollWidth<=innerWidth+2`),
      );
      await shot("mobile-navigation");
      await click("dialog[open] .mgr-modal-head button");
      check(
        "mobile navigation closes",
        await ev(`!document.querySelector('dialog[open]')`),
      );
      await navigate("phieu-dich-vu?selected=DV-TT-0005");
      await wait(`!!document.querySelector('dialog[open]')`);
      check(
        "mobile order drawer fits",
        await ev(
          `document.querySelector('dialog[open]').getBoundingClientRect().width<=innerWidth+2`,
        ),
      );
      await shot("mobile-order-drawer");
      await navigate("");
      await click(".mgr-header-actions > button:first-child");
      check(
        "dark theme toggles",
        await ev(`document.querySelector('.mgr-app').dataset.theme==='dark'`),
      );
      await shot("dashboard-dark-mobile");
      await click(".mgr-header-actions > button:first-child");
    }
    check("no console or hydration errors", errors.length === 0, errors);
  } finally {
    fs.writeFileSync(
      path.join(output, "browser-results.json"),
      JSON.stringify(
        { origin, checkedAt: new Date().toISOString(), results, errors },
        null,
        2,
      ),
    );
    await send("Emulation.clearDeviceMetricsOverride").catch(() => {});
    ws.close();
    await fetch(`${cdp}/json/close/${tab.id}`).catch(() => {});
  }
  const failed = results.filter((r) => !r.pass);
  console.log(
    JSON.stringify({
      checks: results.length,
      passed: results.length - failed.length,
      failed: failed.map((x) => x.name),
      errors: errors.length,
    }),
  );
  if (failed.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
