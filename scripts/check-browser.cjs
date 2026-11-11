(async () => {
  const fs = require("fs");
  const tabs = await (await fetch("http://127.0.0.1:9229/json/list")).json();
  let tab = tabs.find(
    (t) => t.type === "page" && t.url.startsWith("http://localhost:3000"),
  );
  if (!tab) {
    tab = await (
      await fetch("http://127.0.0.1:9229/json/new?http://localhost:3000", {
        method: "PUT",
      })
    ).json();
  }
  if (!tab) throw new Error("Target tab missing");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let serial = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(m.error) : p.resolve(m.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++serial;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (name) => {
    const r = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const p = require("path").join(process.cwd(), "docs", "qa", name + ".png");
    fs.writeFileSync(p, Buffer.from(r.data, "base64"));
    console.log("SCREENSHOT " + p);
  };
  const mouse = async (x, y) =>
    send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  const click = async (x, y) => {
    await mouse(x, y);
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
    });
  };
  const target = async (expression) =>
    ev(
      "(()=>{const e=" +
        expression +
        ";if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})()",
    );
  const heading = async (text) => {
    await ev(
      '(()=>{const e=[...document.querySelectorAll("h1,h2,h3")].find(e=>e.innerText===' +
        JSON.stringify(text) +
        ');if(e)scrollTo({top:e.getBoundingClientRect().top+scrollY-120,behavior:"instant"})})()',
    );
    await pause(450);
  };
  const goto = async (path) => {
    await send("Page.navigate", { url: "http://localhost:3000" + path });
    await pause(1600);
    for (let i = 0; i < 8; i++) {
      if (await ev('document.readyState==="complete"')) break;
      await pause(300);
    }
  };
  const record = async () =>
    ev(
      '({url:location.href,title:document.title,headings:[...document.querySelectorAll("h1,h2,h3")].map(e=>e.innerText),height:document.documentElement.scrollHeight,images:[...document.querySelectorAll("img")].map(e=>({alt:e.alt,src:e.src,width:e.naturalWidth,height:e.naturalHeight})),videos:[...document.querySelectorAll("video")].map(e=>({src:e.currentSrc||e.src,poster:e.poster})),links:[...new Set([...document.querySelectorAll("a")].map(e=>e.href).filter(h=>h.startsWith(location.origin)))]})',
    );
  const sweep = async () => {
    const h = await ev("document.documentElement.scrollHeight");
    for (let y = 600; y < h; y += 850) {
      await send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x: 1000,
        y: 650,
        deltaX: 0,
        deltaY: 850,
      });
      await pause(160);
    }
    await ev('scrollTo({top:0,behavior:"instant"})');
    await pause(300);
  };
  const manifestPath = require("path").join(
    require("os").tmpdir(),
    "dpauto-reference-manifest.json",
  );
  const saveRecord = (r) => {
    let a = [];
    try {
      a = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {}
    a = a.filter((p) => p.url !== r.url);
    a.push(r);
    fs.writeFileSync(manifestPath, JSON.stringify(a, null, 2));
  };
  try {
    fs.mkdirSync("docs/qa", { recursive: true });
    await send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await send("Page.bringToFront");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause(300);

    const results = [];
    const errors = [];
    ws.addEventListener("message", (event) => {
      const m = JSON.parse(event.data);
      if (m.method === "Runtime.exceptionThrown")
        errors.push(
          m.params.exceptionDetails.text +
            ": " +
            (m.params.exceptionDetails.exception?.description || ""),
        );
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
        errors.push(
          m.params.args.map((a) => a.value || a.description || "").join(" "),
        );
    });
    await send("Runtime.enable");
    const check = (name, value, details) => {
      results.push({ name, passed: !!value, details });
      console.log(
        (value ? "PASS " : "FAIL ") +
          name +
          (details ? " " + JSON.stringify(details) : ""),
      );
    };
    const findClick = async (selector) => {
      await send("Emulation.setFocusEmulationEnabled", { enabled: true });
      await send("Page.bringToFront");
      await ev(
        "document.querySelector(" +
          JSON.stringify(selector) +
          ")?.scrollIntoView({block:'center',behavior:'instant'})",
      );
      await pause(750);
      let t = await target(
        "document.querySelector(" + JSON.stringify(selector) + ")",
      );
      if (!t) throw new Error("Missing " + selector);
      await click(t.x, t.y);
      await pause(400);
    };
    await goto("/?qa=interactions");
    await ev('scrollTo({top:0,behavior:"instant"})');
    await ev("document.fonts.ready.then(()=>true)");
    await pause(700);
    await ev(
      'Promise.race([document.querySelector(".hero-background img").decode().catch(()=>true),new Promise(r=>setTimeout(r,2000))])',
    );
    await mouse(0, 0);
    await snap("dpauto-local-desktop-verified");
    check(
      "Main typography",
      await ev(
        'getComputedStyle(document.querySelector("h1")).fontFamily.includes("Barlow Condensed")&&getComputedStyle(document.body).fontFamily.includes("Inter")',
      ),
    );
    await findClick(".desktop-nav button");
    check(
      "Desktop service menu",
      await ev(
        'document.querySelectorAll(".services-menu-grid a").length===10',
      ),
    );
    await findClick(".services-menu-grid a");
    check(
      "Service menu navigation",
      await ev('location.pathname==="/services/detail-wash"'),
    );
    await goto("/?qa=interaction-home");
    await findClick(".faq-item button");
    check(
      "FAQ expands with original answer",
      await ev(
        'document.querySelector(".faq-item button").getAttribute("aria-expanded")==="true"&&document.querySelector(".faq-item [role=region]").textContent.length>20',
      ),
    );
    await findClick(".faq-list>div:nth-child(2) .faq-item button");
    check(
      "FAQ permits multiple open answers",
      await ev(
        'document.querySelectorAll(".faq-item button[aria-expanded=true]").length===2',
      ),
    );
    await snap("dpauto-local-faq-verified");
    await ev(
      'document.querySelector(".before-after").scrollIntoView({block:"center",behavior:"instant"})',
    );
    await pause(1800);
    const rect = await ev(
      'document.querySelector(".before-after").getBoundingClientRect().toJSON()',
    );
    await mouse(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: rect.x + rect.width * 0.5,
      y: rect.y + rect.height * 0.5,
      button: "left",
      clickCount: 1,
    });
    for (let i = 1; i <= 10; i++) {
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: rect.x + rect.width * (0.5 + i * 0.03),
        y: rect.y + rect.height * 0.5,
        button: "left",
        buttons: 1,
      });
    }
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: rect.x + rect.width * 0.8,
      y: rect.y + rect.height * 0.5,
      button: "left",
      clickCount: 1,
    });
    await pause(300);
    check(
      "Comparison pointer drag",
      await ev(
        'Number(document.querySelector(".before-after").getAttribute("aria-valuenow"))>=78',
      ),
    );
    await ev('document.querySelector(".before-after").focus()');
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowLeft",
      code: "ArrowLeft",
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "ArrowLeft",
      code: "ArrowLeft",
    });
    await pause(100);
    check(
      "Comparison keyboard arrows",
      await ev(
        'Number(document.querySelector(".before-after").getAttribute("aria-valuenow"))===78',
      ),
    );
    await snap("dpauto-local-comparison-verified");
    await findClick(".carousel-arrow--next");
    check(
      "Carousel next",
      await ev(
        'document.querySelector(".comparison-slide[aria-hidden=false] h3").innerText==="Interior Detailing"',
      ),
    );
    await findClick(".social-mosaic .gallery-tile button");
    check(
      "Gallery opens lightbox",
      await ev('!!document.querySelector(".lightbox[aria-modal=true]")'),
    );
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
    });
    await pause(450);
    check(
      "Gallery closes with Escape",
      await ev(
        '!document.querySelector(".lightbox")&&document.body.style.overflow!=="hidden"',
      ),
    );
    await findClick(".social-mosaic>.video-player .video-play-large");
    await pause(1200);
    check(
      "Original video plays",
      await ev(
        '(()=>{const v=document.querySelector(".social-mosaic>.video-player video");return !v.paused&&v.currentTime>0})()',
      ),
    );
    await ev(
      'document.querySelector(".social-mosaic>.video-player video").pause()',
    );
    for (const width of [320, 390, 768, 810, 1024, 1440]) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height: width < 810 ? 844 : 900,
        deviceScaleFactor: 1,
        mobile: width < 810,
      });
      await goto("/?qa=width-" + width);
      await ev('scrollTo({top:0,behavior:"instant"})');
      await pause(400);
      const data = await ev(
        "({viewport:innerWidth,width:document.documentElement.scrollWidth,body:document.body.scrollWidth})",
      );
      check("Home layout " + width, data.width <= data.viewport + 2, data);
      if (width === 390) {
        await snap("dpauto-local-mobile-verified");
        await findClick(".menu-toggle");
        check(
          "Mobile navigation opens",
          await ev(
            '!!document.querySelector("#mobile-navigation")&&document.querySelector(".menu-toggle").getAttribute("aria-expanded")==="true"',
          ),
        );
        await snap("dpauto-local-menu-verified");
        await findClick('#mobile-navigation a[href="/about"]');
        await pause(1000);
        check(
          "Mobile navigation changes route",
          await ev('location.pathname==="/about"'),
        );
      }
    }
    const routeChecks = [
      "/services",
      "/services/ceramic-coating",
      "/our-work",
      "/news",
      "/news/ceramic-coating-maintenance-guide",
      "/about",
      "/contact",
      "/privacy",
    ];
    for (const path of routeChecks) {
      await goto(path);
      await pause(250);
      const info = await ev(
        '({h1:document.querySelector("h1")?.innerText,width:document.documentElement.scrollWidth,viewport:innerWidth,broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src)})',
      );
      check(
        "Desktop route " + path,
        !!info.h1 &&
          info.width <= info.viewport + 2 &&
          info.broken.length === 0,
        info,
      );
      if (["/services", "/news", "/about"].includes(path)) {
        await ev('scrollTo({top:0,behavior:"instant"})');
        await snap("dpauto-local-" + path.slice(1) + "-verified");
      }
    }
    await ev(
      'document.querySelector(".footer-wordmark").scrollIntoView({block:"center",behavior:"instant"})',
    );
    await pause(2200);
    check(
      "Footer WebGL effects",
      await ev(
        '[...document.querySelectorAll(".footer-shader")].every(e=>e.dataset.renderer==="webgl")',
      ),
    );
    await snap("dpauto-local-footer-verified");
    check("No browser runtime errors", errors.length === 0, errors);
    fs.mkdirSync("docs/qa", { recursive: true });
    fs.writeFileSync(
      "docs/qa/browser-check.json",
      JSON.stringify({ results, errors }, null, 2),
    );
    console.log(
      "COMPLETE " +
        results.filter((r) => r.passed).length +
        "/" +
        results.length,
    );
    if (results.some((r) => !r.passed)) process.exitCode = 1;
    await goto("/");
    await ev('scrollTo({top:0,behavior:"instant"})');
  } finally {
    ws.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
