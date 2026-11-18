const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const esbuild = require("../backend/node_modules/esbuild");
const { chrome } = require("./check-service-tickets.cjs");
const { fixture } = require("../tests/helpers/service-workflow-render.cjs");
const root = path.resolve(__dirname, ".."),
  output = path.join(root, "docs/qa/service-workspace");
const scenes = [
  ["quote", "QUOTING", 1440, "light"],
  ["waiting", "WAITING_FOR_WORK", 1440, "light"],
  ["work", "IN_PROGRESS", 1440, "light"],
  ["pause", "IN_PROGRESS", 820, "dark"],
  ["vehicle", "IN_PROGRESS", 390, "light"],
  ["handover", "HANDOVER", 820, "light"],
  ["blocked", "HANDOVER", 390, "dark"],
  ["completed", "COMPLETED", 1440, "dark"],
  ["aborted", "ABORTED", 390, "light"],
  ["readonly", "IN_PROGRESS", 820, "light"],
  ["error", "QUOTING", 390, "light"],
  ["quote-close", "QUOTING", 820, "light"],
  ["pending", "QUOTING", 1440, "light"],
  ["extra", "IN_PROGRESS", 1440, "light"],
  ["layout-desktop", "IN_PROGRESS", 1440, "light"],
  ["layout-tablet", "IN_PROGRESS", 820, "dark"],
  ["layout-mobile", "IN_PROGRESS", 390, "light"],
  ["vehicle-layout", "IN_PROGRESS", 1440, "light"],
  ["intake-desktop", "IN_PROGRESS", 1440, "light"],
  ["intake-tablet", "IN_PROGRESS", 820, "dark"],
  ["intake-mobile", "IN_PROGRESS", 390, "light"],
  ["money-desktop", "QUOTING", 1440, "light"],
  ["money-tablet", "QUOTING", 820, "dark"],
  ["money-mobile", "QUOTING", 390, "light"],
  ["money-readonly-desktop", "QUOTING", 1440, "light"],
  ["money-readonly-mobile", "QUOTING", 390, "light"],
].filter((s) => !process.argv[2] || process.argv[2].split(",").includes(s[0]));
function data(scene) {
  const [name, stage] = scene,
    f = fixture(stage);
  const visit = {
    ...f,
    origin: "BOOKING",
    bookingId: "booking",
    followUpOfVisitId: "previous",
    receivedAt: "2026-11-16T01:00:00Z",
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
  };
  delete visit.data;
  if (name.startsWith("money-")) {
    const quote = f.data.quotes[0],
      line = quote.lines[0];
    quote.lines.push({
      ...line,
      id: "part",
      kind: "PART",
      serviceId: null,
      name: "Bộ lọc điều hòa",
      code: "FILTER",
      unitPrice: "987654321",
      total: "1086419753",
    });
    f.data.quotes.unshift({
      ...quote,
      id: "old-quote",
      status: name.startsWith("money-readonly") ? "APPROVED" : "VOIDED",
      voidedLineIds: ["cancelled-zero", "cancelled-large"],
      lines: [
        { ...line, id: "cancelled-zero", unitPrice: "0", total: "0" },
        {
          ...line,
          id: "cancelled-large",
          unitPrice: "123456789",
          total: "135802468",
        },
      ],
    });
  }
  if (["COMPLETED", "ABORTED"].includes(stage)) visit.allowedActions = [];
  if (name === "blocked") f.data.settlement.outstanding = "1100000";
  if (name === "pending") f.data.quotes[0].status = "PENDING_APPROVAL";
  if (name === "extra") {
    const original = f.data.quotes[0];
    f.data.quotes.push({
      ...original,
      id: "extra",
      kind: "CHANGE_ORDER",
      status: "DRAFT",
      approvedTotal: null,
      lines: [
        {
          ...original.lines[0],
          id: "part",
          kind: "PART",
          name: "Bộ lọc điều hòa than hoạt tính",
          serviceId: null,
          unit: "Cái",
          unitPrice: "250000",
          total: "275000",
        },
      ],
      total: "275000",
    });
    f.data.quoteTotals.pending = "275000";
    f.data.quoteTotals.proposed = "1375000";
  }
  const service = {
    id: "service",
    code: "BD",
    name: "Bảo dưỡng định kỳ",
    active: true,
    bookable: true,
  };
  f.data.work.items = [
    {
      id: "work-item",
      label: service.name,
      status: stage === "WAITING_FOR_WORK" ? "PENDING" : "DONE",
      technicians: [{ id: "tech", name: "Nguyễn Văn Bình" }],
      dueAt: "2026-11-16T04:00:00Z",
      quoteLineId: "line",
    },
  ];
  return {
    visit,
    workflow: f.data,
    service,
    technician: { id: "tech", name: "Nguyễn Văn Bình", active: true },
    session: {
      staff: { id: "advisor", name: "Trần Minh Khang" },
      roles: ["ADVISOR"],
      permissions:
        name === "readonly"
          ? ["visits.read", "quotes.read"]
          : [
              "visits.read",
              "quotes.read",
              "quotes.write",
              "quotes.decide",
              "work.write",
              "acceptance.record",
              "visits.handover",
              "visits.abort",
            ],
    },
    calls: [],
    fail: false,
    loadError: name === "error",
  };
}
async function main() {
  assert.ok(scenes.length);
  const bundle = await esbuild.build({
    entryPoints: [
      path.join(root, "tests/helpers/service-workspace-browser.tsx"),
    ],
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "workspace-fixture",
        setup(build) {
          build.onResolve({ filter: /^next\/image$/ }, () => ({
            path: "image",
            namespace: "fixture-image",
          }));
          build.onLoad({ filter: /.*/, namespace: "fixture-image" }, () => ({
            contents:
              "const React=require('react');exports.default=({unoptimized,priority,fill,...props})=>React.createElement('img',props);",
            resolveDir: root,
          }));
          build.onResolve(
            {
              filter:
                /^(next\/(link|navigation)|@\/components\/admin\/auth-gate|@\/lib\/api\/client)$/,
            },
            () => ({
              path: path.join(
                root,
                "tests/helpers/service-workspace-mocks.tsx",
              ),
            }),
          );
        },
      },
    ],
  });
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "dpauto-workspace-"));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/bundle.js") {
      res.setHeader("content-type", "text/javascript");
      return res.end(bundle.outputFiles[0].contents);
    }
    if (url.pathname === "/fixture") {
      const scene = scenes.find((s) => s[0] === url.searchParams.get("scene"));
      res.setHeader("content-type", "text/html; charset=utf-8");
      return res.end(
        `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${["fonts", "globals", "admin", "advisor", "advisor-coreui", "advisor-redesign"].map((n) => `<link rel="stylesheet" href="/src/styles/${n}.css">`).join("")}</head><body class="dpauto-theme"><div class="adm-app adv-ui" data-theme="${scene[3]}"><div class="adm-body"><header class="adm-header">Trạm dịch vụ Toàn Trung</header><main class="adm-main"><div id="root"></div></main></div></div><script>window.workspaceTest=${JSON.stringify(data(scene)).replaceAll("<", "\\u003c")}</script><script src="/bundle.js"></script></body></html>`,
      );
    }
    const file = path.resolve(
      root,
      "." +
        (url.pathname.startsWith("/fonts/") ? "/public" : "") +
        url.pathname,
    );
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      res.setHeader(
        "content-type",
        file.endsWith(".css") ? "text/css" : "font/woff2",
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
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chrome(profile);
    for (const [name, stage, width, theme] of scenes) {
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
          `new Promise((resolve,reject)=>{let end=Date.now()+7000; function tick(){if(${expression})resolve(true);else if(Date.now()>end)reject(Error('Timeout: '+${JSON.stringify(expression)}+'; '+document.body.innerText+'; '+JSON.stringify(window.workspaceErrors)));else setTimeout(tick,30)}tick()})`,
        );
      const click = (text) =>
        js(
          `{const el=[...document.querySelectorAll('button,summary,.adv-tabs a')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && e.getClientRects().length);if(!el)throw Error('Missing '+${JSON.stringify(text)});el.click();}`,
        );
      const set = (selector, value) =>
        js(
          `{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing field');Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}`,
        );
      await browser.send("Page.enable", {}, sessionId);
      await browser.send(
        "Page.addScriptToEvaluateOnNewDocument",
        {
          source:
            "window.workspaceErrors=[];addEventListener('error',e=>workspaceErrors.push(e.error?.stack||e.message));",
        },
        sessionId,
      );
      await browser.send(
        "Emulation.setDeviceMetricsOverride",
        { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 },
        sessionId,
      );
      const loaded = browser.event("Page.loadEventFired", sessionId);
      await browser.send(
        "Page.navigate",
        {
          url: `http://127.0.0.1:${server.address().port}/fixture?scene=${name}`,
        },
        sessionId,
      );
      await loaded;
      if (name === "error") {
        await wait("document.querySelector('[role=alert]')");
        await js("window.workspaceTest.loadError=false");
        await click("Tải lại");
      }
      await wait("document.querySelector('.adv-service-workspace')");
      await js("document.fonts.ready");
      await js("window.confirm=()=>true");
      assert.equal(
        await js("document.querySelectorAll('.adv-tabs a').length"),
        4,
      );
      const expected = ["QUOTING"].includes(stage)
        ? "bao-gia"
        : ["HANDOVER", "COMPLETED", "ABORTED"].includes(stage)
          ? "doi-soat"
          : "thi-cong";
      assert.ok(
        await js(
          `document.querySelector('.adv-tabs [aria-current]').href.includes('tab=${expected}')`,
        ),
      );
      if (name === "work") {
        console.log("work: completion form");
        await click("Hoàn tất thi công");
        assert.equal(
          await js("document.querySelector('button[value=finish]').disabled"),
          true,
        );
        await js(
          "document.querySelectorAll('#hoan-tat-thi-cong input[type=checkbox]').forEach(e=>e.click())",
        );
        await set("#hoan-tat-thi-cong select", "PASSED");
        await set(
          "#hoan-tat-thi-cong textarea",
          "Kiểm tra thực tế đạt yêu cầu",
        );
        await js(
          "window.workspaceTest.fail=true;document.querySelector('button[value=finish]').click()",
        );
        console.log("work: checking error retention");
        await wait("document.querySelector('[role=alert]')");
        assert.equal(
          await js(
            "document.querySelector('#hoan-tat-thi-cong textarea').value",
          ),
          "Kiểm tra thực tế đạt yêu cầu",
        );
      }
      if (name === "pause") {
        await js("window.prompt=()=> 'Chờ phụ tùng'");
        await click("Tạm dừng");
        await wait(
          "document.querySelector('[role=status]')?.textContent.includes('Chờ phụ tùng')",
        );
        assert.equal(
          await js("!!document.querySelector('#hoan-tat-thi-cong')"),
          false,
        );
        await click("Tiếp tục thi công");
        await wait("document.querySelector('#hoan-tat-thi-cong')");
      }
      if (name === "vehicle") {
        await click("Thông tin xe");
        await wait(
          "document.querySelector('h2')?.textContent==='Khách hàng và xe'",
        );
        assert.ok(
          await js(
            "document.body.textContent.includes('45') && document.body.textContent.includes('Xem lịch hẹn')",
          ),
        );
        await click("Cập nhật tiếp nhận");
        await wait("document.querySelector('.adv-intake-dialog')?.open");
        await click("Bỏ thay đổi");
        await click("Công việc");
      }
      if (name.startsWith("intake-")) {
        await click("Thông tin xe");
        await click("Cập nhật tiếp nhận");
        await wait("document.querySelector('.adv-intake-dialog')?.open");
        assert.equal(await js("document.body.style.overflow"), "hidden");
        assert.equal(
          await js("document.activeElement.getAttribute('aria-label')"),
          "Đóng cập nhật tiếp nhận",
        );
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
        await wait("!document.querySelector('.adv-intake-dialog')");
        assert.equal(
          await js("document.activeElement.textContent.trim()"),
          "Cập nhật tiếp nhận",
        );
        assert.equal(await js("document.body.style.overflow"), "");
        await click("Cập nhật tiếp nhận");
        await wait("document.querySelector('.adv-intake-dialog')?.open");
        await set(".adv-intake-dialog [data-odometer]", "123456");
        await set(".adv-intake-dialog textarea", "Yêu cầu đã cập nhật");
        await set(
          ".adv-intake-dialog input[maxlength='400']",
          "Đối chiếu xe thực tế",
        );
        await js("window.workspaceTest.fail=true");
        await click("Lưu thông tin");
        await wait("document.querySelector('.adv-intake-dialog [role=alert]')");
        assert.equal(
          await js(
            "document.querySelector('.adv-intake-dialog textarea').value",
          ),
          "Yêu cầu đã cập nhật",
        );
        assert.equal(
          await js(
            "document.querySelector('.adv-intake-dialog [data-odometer]').value",
          ),
          "123.456",
        );
        const popup = await js(
          `(()=>{const d=document.querySelector('.adv-intake-dialog'),b=d.querySelector('.adv-intake-dialog-body'),f=d.querySelector('.adm-dialog-actions');b.scrollTop=b.scrollHeight;const r=d.getBoundingClientRect(),a=f.getBoundingClientRect();return {modal:d.matches(':modal'),overflow:d.scrollWidth>d.clientWidth+1,left:r.left,right:r.right,top:r.top,bottom:r.bottom,footer:a.bottom,height:innerHeight,width:innerWidth,scrolls:b.scrollHeight>b.clientHeight};})()`,
        );
        assert.equal(popup.modal, true);
        assert.equal(popup.overflow, false);
        assert.ok(
          popup.left >= 0 &&
            popup.right <= width &&
            popup.top >= 0 &&
            popup.bottom <= popup.height,
        );
        assert.ok(popup.footer <= popup.bottom);
        if (width < 768) assert.equal(popup.scrolls, true);
        await fs.writeFile(
          path.join(output, `${name}-${width}-${theme}-popup.png`),
          Buffer.from(
            (
              await browser.send(
                "Page.captureScreenshot",
                { format: "png" },
                sessionId,
              )
            ).data,
            "base64",
          ),
        );
        await click("Bỏ thay đổi");
        await wait("!document.querySelector('.adv-intake-dialog')");
        assert.equal(await js("window.workspaceTest.calls.length"), 1);
        await click("Cập nhật tiếp nhận");
        await wait("document.querySelector('.adv-intake-dialog')?.open");
        assert.equal(
          await js(
            "document.querySelector('.adv-intake-dialog textarea').value",
          ),
          "Kiểm tra động cơ và bảo dưỡng định kỳ",
        );
        await set(".adv-intake-dialog [data-odometer]", "100000");
        await set(".adv-intake-dialog input[maxlength='400']", "Cập nhật ODO");
        await js("window.workspaceTest.fail=false");
        await click("Lưu thông tin");
        await wait(
          "!document.querySelector('.adv-intake-dialog') && document.querySelector('.adv-service-workspace')",
        );
        const saved = await js("window.workspaceTest.calls.at(-1)");
        assert.equal(saved.method, "PATCH");
        assert.equal(saved.body.intake.odometer, 100000);
        assert.equal(saved.body.reason, "Cập nhật ODO");
        assert.equal(await js("document.body.style.overflow"), "");
      }
      if (name === "handover") {
        assert.ok(
          await js("!document.querySelector('button.adm-primary:disabled')"),
        );
        await set("form textarea", "Đã giao xe và chìa khóa cho khách");
        await js("document.querySelector('form input[type=checkbox]').click()");
      }
      if (name === "blocked")
        assert.ok(
          await js(
            "[...document.querySelectorAll('button')].find(e=>e.textContent==='Hoàn thành phiếu')?.disabled",
          ),
        );
      if (name === "readonly")
        assert.equal(
          await js("!!document.querySelector('.adv-service-completion')"),
          false,
        );
      if (name === "completed" || name === "aborted")
        assert.ok(
          await js(
            "document.body.textContent.includes('Tiếp nhận xe tại trạm') && !document.querySelector('button[value=finish]')",
          ),
        );
      if (name === "quote") {
        const fields = await js(
          "document.querySelectorAll('.adv-quote-table input,.adv-quote-table textarea').length",
        );
        assert.ok(fields > 0);
        assert.equal(
          await js(
            "document.querySelector('.adv-quote-table').scrollWidth > document.querySelector('.adv-quote-table').clientWidth+1",
          ),
          false,
        );
      }
      if (name.startsWith("money-")) {
        const alignment = await js(`(()=>{
          const right=e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect().right;};
          const tables=[...document.querySelectorAll('.adv-quote-table')];
          return tables.map(t=>({
            header:getComputedStyle(t.querySelector('th.adv-quote-amount')).textAlign,
            amounts:[...t.querySelectorAll('td.adv-quote-amount strong')].map(e=>({gap:Math.abs(right(e)-right(t.querySelector('th.adv-quote-amount'))),wrap:getComputedStyle(e.parentElement).whiteSpace})),
            prices:[...t.querySelectorAll('td.adv-money-cell')].map(e=>{const input=e.querySelector('input'),head=right(t.querySelector('th.adv-money-cell'));const s=input&&getComputedStyle(input);return input?Math.abs(head-(input.getBoundingClientRect().right-parseFloat(s.paddingRight)-parseFloat(s.borderRightWidth))):Math.abs(head-right(e.querySelector('.adm-field > span:not(.adv-quote-cell-label)')));}),
            summary:[...document.querySelectorAll('.adv-money-list')].map(d=>[...d.querySelectorAll('dd')].map(right))
          }));
        })()`);
        assert.equal(alignment.length, 2);
        for (const table of alignment) {
          assert.equal(table.header, "right");
          for (const amount of table.amounts) {
            assert.ok(amount.gap <= 1.5, JSON.stringify(table));
            assert.equal(amount.wrap, "nowrap");
          }
          assert.ok(
            table.prices.every((gap) => gap <= 1.5),
            JSON.stringify(table),
          );
          for (const edges of table.summary)
            assert.ok(
              Math.max(...edges) - Math.min(...edges) <= 1.5,
              JSON.stringify(edges),
            );
        }
        if (name.startsWith("money-readonly")) {
          assert.equal(
            await js(
              "document.querySelectorAll('.adv-quote-table .is-inactive').length",
            ),
            2,
          );
          const edges = alignment.flatMap((t) => t.summary.flat());
          assert.ok(
            Math.max(...edges) - Math.min(...edges) <= 1.5,
            JSON.stringify(edges),
          );
          await js(
            "document.querySelectorAll('.adv-quote-scroll').forEach(e=>e.scrollLeft=e.scrollWidth)",
          );
        }
      }
      if (name === "quote-close") {
        assert.equal(
          await js("document.querySelector('button[value=close]').disabled"),
          true,
        );
        await click("Chốt báo giá");
        assert.equal(await js("workspaceTest.calls.length"), 0);
        await js("document.querySelector('.adv-quote-consent input').click()");
      }
      if (name === "pending") {
        await set("form select", "APPROVED");
        await set("form textarea", "Khách đã thống nhất hạng mục và chi phí");
      }
      if (name === "extra") {
        assert.equal(
          await js("!!document.querySelector('.adv-quote-editor')"),
          false,
        );
        await click("Báo giá & Phát sinh");
        assert.ok(
          await js(
            "document.querySelectorAll('.adv-quote-name').length===2 && !document.querySelector('.adv-quote-name .adm-badge')",
          ),
        );
      }
      if (name === "vehicle-layout") await click("Thông tin xe");
      if (name.startsWith("layout-")) {
        await click("Hoàn tất thi công");
        await js(
          "document.querySelector('#hoan-tat-thi-cong textarea').scrollIntoView({block:'start'})",
        );
        await js(
          "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
        );
        const position = await js(
          "({field:document.querySelector('#hoan-tat-thi-cong textarea').getBoundingClientRect().top,bar:document.querySelector('.adv-tabs').getBoundingClientRect().bottom})",
        );
        assert.ok(position.field >= position.bar - 1, JSON.stringify(position));
        await js("scrollTo(0,0)");
      }
      await js(
        "scrollTo(0,0);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
      );
      const measured = await js(
        `(()=>{const els=[...document.querySelectorAll('input:not([type=checkbox]),textarea,select,button,summary,.adv-tabs a')].filter(e=>e.checkVisibility()&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'); const overlaps=[];for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){if(els[i].contains(els[j])||els[j].contains(els[i]))continue;const a=els[i].getBoundingClientRect(),b=els[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)overlaps.push([els[i].tagName,els[j].tagName]);}return {overflow:document.documentElement.scrollWidth>innerWidth+1,overlaps,header:document.querySelector('.adv-service-header').getBoundingClientRect().height,headerLayout:[...document.querySelector('.adv-service-header').children].map(e=>({tag:e.className,height:e.getBoundingClientRect().height,margin:getComputedStyle(e).margin,padding:getComputedStyle(e).padding}))};})()`,
      );
      await fs.writeFile(
        path.join(output, `${name}-${width}-${theme}.png`),
        Buffer.from(
          (
            await browser.send(
              "Page.captureScreenshot",
              { format: "png", captureBeyondViewport: true },
              sessionId,
            )
          ).data,
          "base64",
        ),
      );
      assert.equal(measured.overflow, false, name + " horizontal overflow");
      assert.equal(
        measured.overlaps.length,
        0,
        name + " control overlaps " + JSON.stringify(measured.overlaps),
      );
      assert.deepEqual(await js("window.workspaceErrors"), []);
      if (name === "work") {
        await js(
          "window.workspaceTest.fail=false;document.querySelector('button[value=finish]').click()",
        );
        await wait(
          "document.querySelector('.adv-tabs [aria-current]')?.href.includes('doi-soat')",
        );
        const body = await js("window.workspaceTest.calls.at(-1).body");
        assert.equal(body.quality.completionConfirmed, true);
        assert.equal(body.quality.result, "PASSED");
        assert.equal(body.quality.qualityChecks[0].passed, true);
      }
      if (name === "waiting") {
        await click("Bắt đầu thi công");
        await wait("document.querySelector('.adv-service-completion')");
      }
      if (name === "handover") {
        await click("Hoàn thành phiếu");
        await wait("document.body.textContent.includes('Đã bàn giao')");
        assert.equal(
          await js("window.workspaceTest.calls.at(-1).body.vehicleMoved"),
          true,
        );
      }
      if (name === "quote-close" || name === "pending") {
        await click("Chốt báo giá");
        await wait("window.workspaceTest.calls.length===1");
        const c = await js("workspaceTest.calls[0]");
        assert.equal(
          c.body.evidence.customerName,
          "Nguyễn Thị Ngọc Phương Anh",
        );
        assert.equal(c.body.expectedVersion, 1);
        assert.equal(c.method, "POST");
        if (name === "quote-close") {
          assert.ok(c.path.endsWith("/close"));
          assert.equal(c.body.lines.length, 1);
        } else {
          assert.ok(c.path.endsWith("/decision"));
          assert.equal(c.body.decision, "APPROVED");
          assert.deepEqual(c.body.approvedLineIds, ["line"]);
        }
      }
      results[name] = { stage, width, theme, ...measured, passed: true };
      await fs.writeFile(
        path.join(output, "results.json"),
        JSON.stringify(results, null, 2),
      );
      console.log(`${name}: PASS`);
      await browser.send("Target.closeTarget", { targetId });
    }
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
    assert.equal(path.dirname(profile), path.resolve(os.tmpdir()));
    await fs
      .rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      })
      .catch((e) => console.warn("Temporary profile: " + e.code));
  }
}
main().catch((e) => {
  console.error(e.stack?.split("\n").slice(0, 6).join("\n") || e.message);
  process.exitCode = 1;
});
