const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const esbuild = require("../backend/node_modules/esbuild");
const { chrome } = require("./check-service-tickets.cjs");
const root = path.resolve(__dirname, ".."),
  output = path.join(root, "docs/qa/reception");
const scenarios = [
  {
    name: "keyboard-390-dark",
    mode: "walk-in",
    width: 390,
    theme: "dark",
    keyboard: true,
  },
  {
    name: "keyboard-1440-dark",
    mode: "walk-in",
    width: 1440,
    theme: "dark",
    keyboard: true,
  },
  { name: "booking-1440-light", mode: "booking", width: 1440, theme: "light" },
  { name: "booking-390-light", mode: "booking", width: 390, theme: "light" },
  { name: "booking-820-light", mode: "booking", width: 820, theme: "light" },
  { name: "booking-1440-dark", mode: "booking", width: 1440, theme: "dark" },
  { name: "new-car-820-dark", mode: "new-car", width: 820, theme: "dark" },
  { name: "walk-in-390-light", mode: "walk-in", width: 390, theme: "light" },
].filter(
  (s) =>
    !process.argv[2] ||
    (process.argv[2] === "keyboard"
      ? s.keyboard
      : process.argv[2].split(",").includes(s.name)),
);
async function main() {
  assert.ok(scenarios.length);
  const built = await esbuild.build({
    entryPoints: [path.join(root, "tests/helpers/reception-browser.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "reception-fixture",
        setup(build) {
          build.onResolve(
            {
              filter:
                /^(next\/(link|navigation)|@\/components\/admin\/auth-gate|@\/lib\/api\/client)$/,
            },
            () => ({
              path: path.join(root, "tests/helpers/reception-mocks.tsx"),
            }),
          );
        },
      },
    ],
  });
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "dpauto-reception-"));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/bundle.js") {
      res.setHeader("content-type", "text/javascript");
      return res.end(built.outputFiles[0].contents);
    }
    if (url.pathname === "/fixture") {
      const s = scenarios.find(
        (s) =>
          s.mode === url.searchParams.get("mode") &&
          s.theme === url.searchParams.get("theme"),
      );
      res.setHeader("content-type", "text/html; charset=utf-8");
      return res.end(
        `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${["fonts", "globals", "admin", "advisor", "advisor-coreui", "advisor-redesign"].map((n) => `<link rel="stylesheet" href="/src/styles/${n}.css">`).join("")}</head><body class="dpauto-theme"><div class="adm-app adv-ui" data-theme="${s.theme}"><div class="adm-body"><main class="adm-main"><div id="root"></div></main></div></div><script src="/bundle.js"></script></body></html>`,
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
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chrome(profile);
    const results = await fs
      .readFile(path.join(output, "results.json"), "utf8")
      .then(JSON.parse)
      .catch(() => ({}));
    for (const s of scenarios) {
      const { targetId } = await browser.send("Target.createTarget", {
        url: "about:blank",
      });
      const { sessionId } = await browser.send("Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      const js = async (expression) => {
        const value = await browser.send(
          "Runtime.evaluate",
          { expression, awaitPromise: true, returnByValue: true },
          sessionId,
        );
        assert.ok(
          !value.exceptionDetails,
          JSON.stringify(value.exceptionDetails),
        );
        return value.result.value;
      };
      const wait = async (expression) =>
        js(
          `new Promise((resolve,reject)=>{const end=Date.now()+7000;function tick(){if(${expression})resolve(true);else if(Date.now()>end)reject(Error('Fixture timeout'));else setTimeout(tick,30);}tick();})`,
        );
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
          url: `http://127.0.0.1:${server.address().port}/fixture?mode=${s.mode}&theme=${s.theme}`,
        },
        sessionId,
      );
      await loaded;
      await wait("document.querySelector('.adv-reception')");
      const set = async (selector, value) =>
        js(
          `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Field missing: '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
        );
      assert.equal(
        await js(
          "[...document.querySelectorAll('label')].some(e=>e.textContent.includes('Lý do'))",
        ),
        false,
      );
      if (s.mode === "new-car")
        await set(
          '.adv-reception-vehicle input[maxlength="100"]',
          "Mercedes-Benz GLC 300 4MATIC",
        );
      if (s.mode === "walk-in") {
        await set(
          '.adv-reception-customer input[maxlength="100"]',
          "Khách tiếp nhận trực tiếp",
        );
        await set('.adv-reception-customer input[type="tel"]', "0772584279");
        await set(
          '.adv-reception-vehicle input[maxlength="100"]',
          "Toyota Vios",
        );
        await set(
          ".adv-reception-intake textarea[required]",
          "Rửa xe và kiểm tra điều hòa",
        );
        await js(
          "document.querySelector('.adv-check-grid input').click();document.querySelector('.adv-reception-notice input').click()",
        );
      }
      if (s.keyboard) {
        const tab = async () => {
          await browser.send(
            "Input.dispatchKeyEvent",
            {
              type: "keyDown",
              key: "Tab",
              code: "Tab",
              windowsVirtualKeyCode: 9,
            },
            sessionId,
          );
          await browser.send(
            "Input.dispatchKeyEvent",
            {
              type: "keyUp",
              key: "Tab",
              code: "Tab",
              windowsVirtualKeyCode: 9,
            },
            sessionId,
          );
        };
        await js(
          "document.querySelector('.adv-reception-customer select').focus()",
        );
        await tab();
        assert.equal(
          await js(
            "document.activeElement===document.querySelector('.adv-reception-customer input[maxlength=\"100\"]')",
          ),
          true,
        );
        await js(
          "document.querySelector('.adv-reception-verify input').focus()",
        );
        await tab();
        assert.equal(
          await js(
            "document.activeElement===document.querySelector('.adv-reception-vehicle input[maxlength=\"100\"]')",
          ),
          true,
        );
        const layout = await js(
          "document.fonts.ready.then(()=>({overflow:document.documentElement.scrollWidth>innerWidth,columns:getComputedStyle(document.querySelector('.adv-reception-grid')).display,inspectionCollapsed:!document.querySelector('.adv-reception-inspection details').open}))",
        );
        assert.equal(layout.overflow, false);
        assert.equal(layout.columns, s.width === 1440 ? "grid" : "flex");
        assert.equal(layout.inspectionCollapsed, true);
        const shot = await browser.send(
          "Page.captureScreenshot",
          { format: "png", captureBeyondViewport: true },
          sessionId,
        );
        await fs.writeFile(
          path.join(output, s.name + ".png"),
          Buffer.from(shot.data, "base64"),
        );
        results[s.name] = { ...layout, keyboard: true, passed: true };
        await fs.writeFile(
          path.join(output, "results.json"),
          JSON.stringify(results, null, 2),
        );
        console.log(s.name + ": PASS");
        await browser.send("Target.closeTarget", { targetId });
        continue;
      }
      await js(
        "document.querySelector('.adv-reception-footer button').click()",
      );
      assert.equal(await js("window.receptionTest.calls.length"), 0);
      assert.equal(
        await js(
          "document.activeElement===document.querySelector('.adv-reception-verify input')",
        ),
        true,
      );
      await js("document.querySelector('.adv-reception-verify input').click()");
      if (s.mode === "booking" || s.mode === "new-car") {
        assert.deepEqual(
          await js(
            "[...document.querySelectorAll('.adv-reception-services input')].map(input => input.checked)",
          ),
          [true, false],
        );
        await js(
          "document.querySelector('.adv-reception-services input').click()",
        );
        assert.equal(
          await js(
            "document.querySelector('.adv-reception-footer button').disabled",
          ),
          true,
        );
        await js(
          "document.querySelectorAll('.adv-reception-services input')[1].click()",
        );
        assert.deepEqual(
          await js(
            "[...document.querySelectorAll('.adv-reception-services input')].map(input => input.checked)",
          ),
          [false, true],
        );
      }
      if (s.name === "booking-1440-dark")
        await set("input[data-odometer]", "45000");
      if (s.mode === "booking" && s.theme === "light") {
        await js("document.querySelector('[data-odometer]').focus()");
        const values = ["1", "10", "100", "1.000", "10.000", "100.000"];
        for (const [index, digit] of [..."100000"].entries()) {
          await browser.send("Input.insertText", { text: digit }, sessionId);
          assert.equal(
            await js("document.querySelector('[data-odometer]').value"),
            values[index],
            "ODO should group digits while typing",
          );
        }
        await js(
          "document.querySelector('[data-odometer]').setSelectionRange(4,4)",
        );
        await browser.send(
          "Input.dispatchKeyEvent",
          {
            type: "keyDown",
            key: "Backspace",
            code: "Backspace",
            windowsVirtualKeyCode: 8,
          },
          sessionId,
        );
        await browser.send(
          "Input.dispatchKeyEvent",
          {
            type: "keyUp",
            key: "Backspace",
            code: "Backspace",
            windowsVirtualKeyCode: 8,
          },
          sessionId,
        );
        assert.equal(
          await js("document.querySelector('[data-odometer]').value"),
          "10.000",
        );
        await set("[data-odometer]", "100000");
        await js(
          "document.querySelector('[data-odometer]').setSelectionRange(3,3)",
        );
        await browser.send(
          "Input.dispatchKeyEvent",
          {
            type: "keyDown",
            key: "Delete",
            code: "Delete",
            windowsVirtualKeyCode: 46,
          },
          sessionId,
        );
        await browser.send(
          "Input.dispatchKeyEvent",
          {
            type: "keyUp",
            key: "Delete",
            code: "Delete",
            windowsVirtualKeyCode: 46,
          },
          sessionId,
        );
        assert.equal(
          await js("document.querySelector('[data-odometer]').value"),
          "10.000",
        );
        await set("[data-odometer]", "100000");
        await js(
          "document.querySelector('[data-odometer]').setSelectionRange(2,2)",
        );
        await browser.send("Input.insertText", { text: "9" }, sessionId);
        assert.equal(
          await js("document.querySelector('[data-odometer]').value"),
          "1.090.000",
        );
        assert.equal(
          await js("document.querySelector('[data-odometer]').selectionStart"),
          4,
        );
        await set("[data-odometer]", "10000000");
        assert.equal(
          await js("document.querySelector('[data-odometer]').checkValidity()"),
          false,
        );
        await set("[data-odometer]", "100000");
        assert.equal(
          await js("document.querySelector('[data-odometer]').checkValidity()"),
          true,
        );
      }
      await js(
        "document.querySelector('.adv-reception-inspection details').open=true",
      );
      if (s.mode === "walk-in") {
        await js(
          "window.receptionTest.fail=true;document.querySelector('form').requestSubmit()",
        );
        await wait("document.querySelector('#reception-error')");
        assert.equal(
          await js(
            "document.querySelector('.adv-reception-vehicle input[maxlength=\"100\"]').value",
          ),
          "Toyota Vios",
        );
        assert.equal(
          await js("document.activeElement.id==='reception-error'"),
          true,
        );
        await js(
          `new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=10;canvas.height=10;canvas.getContext('2d').fillRect(0,0,10,10);canvas.toBlob(blob=>{const list=new DataTransfer();list.items.add(new File([blob],'vehicle.jpg',{type:'image/jpeg'}));const input=document.querySelector('input[type=file][multiple]');input.files=list.files;input.dispatchEvent(new Event('change',{bubbles:true}));resolve();},'image/jpeg');})`,
        );
        await wait("document.querySelector('.adv-photo-grid img')");
        assert.equal(
          await js("document.querySelectorAll('.adv-photo-grid img').length"),
          1,
        );
        await js("document.querySelector('.adv-photo-grid button').click()");
        await wait(
          "document.querySelectorAll('.adv-photo-grid img').length===0",
        );
        await js(
          "window.receptionTest.fail=false;window.receptionTest.calls=[]",
        );
      }
      const measured = await js(
        `document.fonts.ready.then(()=>{const elements=[...document.querySelectorAll('input,select,textarea,button,a.adm-btn')].filter(e=>e.checkVisibility()&&e.getClientRects().length);let overlaps=0;for(let i=0;i<elements.length;i++)for(let j=i+1;j<elements.length;j++){const a=elements[i].getBoundingClientRect(),b=elements[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)overlaps++;}return {overflow:document.documentElement.scrollWidth>innerWidth,overlaps,columns:getComputedStyle(document.querySelector('.adv-reception-grid')).display,sourceDisabled:document.querySelector('select:has(option[value=TOAN_TRUNG])').disabled};})`,
      );
      assert.equal(measured.overflow, false);
      assert.equal(measured.overlaps, 0);
      assert.equal(measured.sourceDisabled, true);
      assert.equal(measured.columns, s.width === 1440 ? "grid" : "flex");
      const shot = await browser.send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: true },
        sessionId,
      );
      await fs.writeFile(
        path.join(output, s.name + ".png"),
        Buffer.from(shot.data, "base64"),
      );
      await js(
        "document.querySelector('form').requestSubmit();document.querySelector('form').requestSubmit()",
      );
      await wait("window.receptionTest.destination");
      const command = await js("window.receptionTest.calls");
      assert.equal(command.length, 1);
      assert.equal(
        command[0].body.intake.odometer,
        s.name === "booking-1440-dark"
          ? 45000
          : s.mode === "booking" && s.theme === "light"
            ? 100000
            : null,
      );
      assert.equal(command[0].body.vehicleVerified, true);
      assert.deepEqual(command[0].body.serviceIds, [
        s.mode === "walk-in" ? "service" : "extra",
      ]);
      assert.equal(command[0].body.catalogVersion, 1);
      for (const key of ["vehicleChangeReason", "followUpReason", "source"])
        assert.equal(key in command[0].body, false);
      for (const key of ["odometerMissingReason", "plateMissingReason"])
        assert.equal(command[0].body.intake[key] ?? null, null);
      assert.equal(
        await js("window.receptionTest.destination"),
        "/co-van/phieu-dich-vu/received-visit",
      );
      results[s.name] = {
        ...measured,
        passed: true,
        submitCount: command.length,
      };
      console.log(s.name + ": PASS");
      await fs.writeFile(
        path.join(output, "results.json"),
        JSON.stringify(results, null, 2),
      );
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
      .catch((error) =>
        console.warn("Temporary Chrome profile retained: " + error.code),
      );
  }
}
main().catch((error) => {
  console.error(
    error.stack?.split("\n").slice(0, 5).join("\n") || error.message,
  );
  process.exitCode = 1;
});
