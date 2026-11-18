const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const {
  tickets,
  ServiceTicketsTable,
} = require("../tests/helpers/service-ticket-render.cjs");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "docs/qa/service-tickets");
const scenarios = [
  { name: "390-light", width: 390, theme: "light" },
  { name: "820-light", width: 820, theme: "light" },
  { name: "1440-light", width: 1440, theme: "light" },
  { name: "1440-dark", width: 1440, theme: "dark" },
].filter((scenario) => !process.argv[2] || scenario.name === process.argv[2]);
if (require.main === module) assert.ok(scenarios.length, "Unknown scenario");
const permissions = [
  "quotes.write",
  "work.write",
  "acceptance.record",
  "visits.handover",
];
const rows = Object.keys(tickets.ticketLabels).map((stage, index) => ({
  id: `ticket-${index}`,
  code: `DV-14112026-${String(index + 1).padStart(3, "0")}`,
  plate: index ? "51K-123.45" : "",
  model: index === 1 ? "Mercedes-Benz GLC 300 4MATIC" : "Toyota Vios",
  customer: index === 1 ? "Nguyễn Thị Ngọc Phương Anh" : "Nguyễn Văn An",
  phone: "0772584279",
  stage,
  label: tickets.ticketLabels[stage],
  amount: {
    value: index === 0 ? null : index === 2 ? "0" : "4500000",
    label: index === 0 ? "Chưa có báo giá" : "Báo giá đã duyệt",
  },
  action: tickets.ticketAction(stage, permissions),
}));
const table = renderToStaticMarkup(
  React.createElement(ServiceTicketsTable, { rows }),
);
function html(theme) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${["fonts", "globals", "admin", "advisor", "advisor-coreui", "advisor-redesign"].map((name) => `<link rel="stylesheet" href="/src/styles/${name}.css">`).join("")}</head><body class="dpauto-theme"><div class="adm-app adv-ui" data-theme="${theme}"><div class="adm-body"><main class="adm-main"><div class="adv-page adv-ticket-page"><div class="adm-page-heading"><div><h1>Phiếu dịch vụ</h1><p class="adm-muted">Theo dõi báo giá, thi công, nghiệm thu và bàn giao xe.</p></div><div class="adv-actions"><button class="adm-btn">Mở lịch hẹn</button><button class="adm-btn adm-primary">Tiếp nhận xe trực tiếp</button></div></div><section class="adm-panel adv-ticket-panel"><div class="adm-search-row"><label class="adm-search"><input placeholder="Mã phiếu, biển số, tên xe, khách hàng, SĐT…" aria-label="Tìm phiếu dịch vụ"></label><details class="adv-ticket-filters"><summary class="adm-btn">Bộ lọc</summary></details></div><div class="adm-quick-filters adv-ticket-tabs">${tickets.ticketTabs.map(([, label], index) => `<button class="${index ? "" : "is-active"}">${label}</button>`).join("")}</div><div class="adm-results-row"><strong>9 phiếu trên trang này</strong></div>${table}<nav class="adv-ticket-pagination"><button class="adm-btn" disabled>Trang trước</button><span>Trang 1</span><button class="adm-btn">Trang sau</button></nav></section></div></main></div></div><script>document.fonts.ready.then(()=>setTimeout(()=>{const tr=document.querySelector('tbody tr');const scroll=document.querySelector('.adv-ticket-scroll');document.documentElement.dataset.qa=encodeURIComponent(JSON.stringify({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,rowDisplay:getComputedStyle(tr).display,headers:document.querySelectorAll('thead th').length,rows:document.querySelectorAll('tbody tr').length,tableScroll:scroll.scrollWidth>scroll.clientWidth}));},100));</script></body></html>`;
}
async function chrome(profile) {
  const child = spawn(
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let connection;
  for (let i = 0; i < 100; i++) {
    connection = await fs
      .readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      .catch(() => "");
    if (connection) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!connection) {
    child.kill();
    throw Error("Chrome did not start");
  }
  const [port, endpoint] = connection.trim().split(/\r?\n/);
  const socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  const events = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (request) {
      clearTimeout(request.timer);
      pending.delete(message.id);
      message.error
        ? request.reject(Error(message.error.message))
        : request.resolve(message.result);
    }
    const key = `${message.sessionId}:${message.method}`;
    const event = events.get(key);
    if (event) {
      clearTimeout(event.timer);
      events.delete(key);
      event.resolve(message.params);
    }
  };
  const rpc = {
    send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(Error(`Chrome timeout: ${method}`));
        }, 10000);
        pending.set(id, { resolve, reject, timer });
        socket.send(
          JSON.stringify({
            id,
            method,
            params,
            ...(sessionId ? { sessionId } : {}),
          }),
        );
      });
    },
    event(method, sessionId) {
      return new Promise((resolve, reject) => {
        const key = `${sessionId}:${method}`;
        const timer = setTimeout(() => {
          events.delete(key);
          reject(Error(`Chrome event timeout: ${method}`));
        }, 10000);
        events.set(key, { resolve, timer });
      });
    },
    async close() {
      await rpc.send("Browser.close").catch(() => {});
      socket.close();
      if (child.exitCode === null) child.kill();
    },
  };
  return rpc;
}
async function main() {
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "dpauto-ticket-ui-"));
  let browser;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/fixture") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html(url.searchParams.get("theme")));
        return;
      }
      const relative = url.pathname.startsWith("/fonts/")
        ? "public" + url.pathname
        : url.pathname;
      const file = path.resolve(
        root,
        "." + (relative.startsWith("/") ? relative : "/" + relative),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".css") ? "text/css" : "font/woff2",
      );
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    browser = await chrome(profile);
    const resultFile = path.join(output, "browser-results.json");
    const results = await fs
      .readFile(resultFile, "utf8")
      .then(JSON.parse)
      .catch(() => ({}));
    for (const scenario of scenarios) {
      const { targetId } = await browser.send("Target.createTarget", {
        url: "about:blank",
      });
      const { sessionId } = await browser.send("Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      await browser.send("Page.enable", {}, sessionId);
      await browser.send(
        "Emulation.setDeviceMetricsOverride",
        {
          width: scenario.width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: scenario.width < 768,
        },
        sessionId,
      );
      const loaded = browser.event("Page.loadEventFired", sessionId);
      await browser.send(
        "Page.navigate",
        { url: `http://127.0.0.1:${port}/fixture?theme=${scenario.theme}` },
        sessionId,
      );
      await loaded;
      const evaluated = await browser.send(
        "Runtime.evaluate",
        {
          expression:
            "document.fonts.ready.then(()=>new Promise(resolve=>setTimeout(()=>resolve({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,rowDisplay:getComputedStyle(document.querySelector('tbody tr')).display,headers:document.querySelectorAll('thead th').length,rows:document.querySelectorAll('tbody tr').length,tableScroll:document.querySelector('.adv-ticket-scroll').scrollWidth>document.querySelector('.adv-ticket-scroll').clientWidth}),150)))",
          awaitPromise: true,
          returnByValue: true,
        },
        sessionId,
      );
      assert.ok(!evaluated.exceptionDetails, "DOM measurement failed");
      const result = evaluated.result.value;
      const screenshot = await browser.send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false },
        sessionId,
      );
      await fs.writeFile(
        path.join(output, scenario.name + ".png"),
        Buffer.from(screenshot.data, "base64"),
      );
      await browser.send("Target.closeTarget", { targetId });
      result.passed =
        result.width === scenario.width &&
        !result.overflow &&
        result.headers === 7 &&
        result.rows === rows.length &&
        result.rowDisplay === (scenario.width < 768 ? "grid" : "table-row");
      results[scenario.name] = result;
      console.log(scenario.name + ": " + JSON.stringify(result));
    }
    await fs.writeFile(resultFile, JSON.stringify(results, null, 2) + "\n");
    assert.ok(
      scenarios.every((scenario) => results[scenario.name].passed),
      "Layout checks failed; rerun only the failing scenario",
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    assert.equal(path.dirname(profile), path.resolve(os.tmpdir()));
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}
module.exports = { chrome };
if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
