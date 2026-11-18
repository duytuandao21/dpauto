const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
const {
  panel,
  printQuote,
} = require("../tests/helpers/service-workflow-render.cjs");
const { chrome } = require("./check-service-tickets.cjs");
const root = path.resolve(__dirname, ".."),
  output = path.join(root, "docs/qa/service-workflow-v2");
const scenarios = [
  ...[
    [390, "light"],
    [820, "dark"],
    [1280, "light"],
    [1440, "dark"],
  ].map(([width, theme]) => ({
    name: `quote-unified-${width}-${theme}`,
    stage: "IN_PROGRESS",
    width,
    theme,
    extra: true,
  })),
  {
    name: "cancel-390-light",
    stage: "IN_PROGRESS",
    width: 390,
    theme: "light",
    cancel: true,
  },
  {
    name: "cancel-1440-dark",
    stage: "IN_PROGRESS",
    width: 1440,
    theme: "dark",
    cancel: true,
  },
  {
    name: "quote-print-1440-light",
    stage: "PRINT",
    width: 1440,
    theme: "light",
  },
  { name: "quote-390-light", stage: "QUOTING", width: 390, theme: "light" },
  { name: "work-390-light", stage: "IN_PROGRESS", width: 390, theme: "light" },
  {
    name: "waiting-820-light",
    stage: "WAITING_FOR_WORK",
    width: 820,
    theme: "light",
  },
  { name: "work-820-dark", stage: "IN_PROGRESS", width: 820, theme: "dark" },
  {
    name: "handover-1440-light",
    stage: "HANDOVER",
    width: 1440,
    theme: "light",
  },
  { name: "handover-1440-dark", stage: "HANDOVER", width: 1440, theme: "dark" },
  {
    name: "completed-1440-dark",
    stage: "COMPLETED",
    width: 1440,
    theme: "dark",
  },
].filter(
  (s) =>
    !process.argv[2] ||
    (process.argv[2] === "quote-unified"
      ? s.extra
      : s.name === process.argv[2]),
);
assert.ok(scenarios.length);
async function main() {
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(
    path.join(os.tmpdir(), "dpauto-workflow-v2-"),
  );
  let browser;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/fixture") {
        const s = scenarios.find(
          (s) => s.name === url.searchParams.get("scenario"),
        );
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end(
          `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${["fonts", "globals", "admin", "advisor", "advisor-coreui", "advisor-redesign"].map((n) => `<link rel="stylesheet" href="/src/styles/${n}.css">`).join("")}</head><body class="dpauto-theme"><div class="adm-app adv-ui" data-theme="${s.theme}"><div class="adm-body"><main class="adm-main"><div class="adv-page"><h1>DV-16112026-001</h1>${renderToStaticMarkup(s.stage === "PRINT" ? printQuote() : panel(s.stage, s.cancel ? { permissions: ["quotes.read", "quotes.write", "quotes.decide", "work.write", "acceptance.record", "visits.handover", "visits.abort", "payments.refund"] } : { extra: s.extra }))}</div></main></div></div></body></html>`,
        );
        return;
      }
      const file = path.resolve(
        root,
        "." +
          (url.pathname.startsWith("/fonts/")
            ? "/public" + url.pathname
            : url.pathname),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader(
        "content-type",
        file.endsWith(".css") ? "text/css" : "font/woff2",
      );
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chrome(profile);
    const resultFile = path.join(output, "browser-results.json"),
      results = await fs
        .readFile(resultFile, "utf8")
        .then(JSON.parse)
        .catch(() => ({}));
    for (const s of scenarios) {
      const { targetId } = await browser.send("Target.createTarget", {
          url: "about:blank",
        }),
        { sessionId } = await browser.send("Target.attachToTarget", {
          targetId,
          flatten: true,
        });
      await browser.send("Page.enable", {}, sessionId);
      await browser.send(
        "Emulation.setDeviceMetricsOverride",
        {
          width: s.width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: s.width < 768,
        },
        sessionId,
      );
      const loaded = browser.event("Page.loadEventFired", sessionId);
      await browser.send(
        "Page.navigate",
        {
          url: `http://127.0.0.1:${server.address().port}/fixture?scenario=${s.name}`,
        },
        sessionId,
      );
      await loaded;
      if (s.cancel) {
        const opened = await browser.send(
          "Runtime.evaluate",
          {
            expression: `[...document.querySelectorAll('details')].filter(d=>d.querySelector('textarea[maxlength="400"]')).map(d=>(d.open=true))`,
            returnByValue: true,
          },
          sessionId,
        );
        assert.ok(
          opened.result.value?.length,
          "Cancellation form was not opened",
        );
      }
      const measured = await browser.send(
        "Runtime.evaluate",
        {
          expression: `document.fonts.ready.then(()=>{const controls=[...document.querySelectorAll('input,select,textarea,button,a.adm-btn')].filter(e=>e.checkVisibility()&&e.getClientRects().length&&e.getBoundingClientRect().width>0);const overlaps=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2)overlaps.push([a.textContent||a.tagName,b.textContent||b.tagName]);}return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,controls:controls.length,overlaps,progress:document.querySelectorAll('.adv-service-progress li').length};})`,
          awaitPromise: true,
          returnByValue: true,
        },
        sessionId,
      );
      assert.ok(!measured.exceptionDetails);
      const r = measured.result.value;
      r.passed =
        r.width === s.width &&
        !r.overflow &&
        !r.overlaps.length &&
        r.progress === (s.stage === "PRINT" ? 0 : 5);
      results[s.name] = r;
      if (s.stage === "PRINT") {
        const pdf = await browser.send(
          "Page.printToPDF",
          { printBackground: true, preferCSSPageSize: true },
          sessionId,
        );
        const bytes = Buffer.from(pdf.data, "base64");
        assert.ok(
          bytes.length > 1000 && bytes.subarray(0, 4).toString() === "%PDF",
        );
        await fs.writeFile(
          path.join(output, "quote-partial-approval.pdf"),
          bytes,
        );
      }
      const shot = await browser.send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: true },
        sessionId,
      );
      await fs.writeFile(
        path.join(output, s.name + ".png"),
        Buffer.from(shot.data, "base64"),
      );
      console.log(
        `${s.name}: ${r.passed ? "PASS" : "FAIL"} (${r.controls} controls, ${r.overlaps.length} overlaps)`,
      );
      await browser.send("Target.closeTarget", { targetId });
    }
    await fs.writeFile(resultFile, JSON.stringify(results, null, 2) + "\n");
    assert.ok(
      scenarios.every((s) => results[s.name].passed),
      "Layout failed; rerun failing scenario only",
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
    assert.equal(path.dirname(profile), path.resolve(os.tmpdir()));
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
