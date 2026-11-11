import fs from "node:fs";

const origin = process.env.CHECK_ORIGIN || "http://127.0.0.1:3000";
const content = JSON.parse(
  fs.readFileSync("src/data/site-content.json", "utf8"),
);
const routes = [
  "/",
  "/services",
  "/our-work",
  "/news",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/404",
  ...content.services.map((s) => `/services/${s.slug}`),
  ...content.articles.map((a) => `/news/${a.slug}`),
];
const results = [];
for (let i = 0; i < routes.length; i += 4) {
  await Promise.all(
    routes.slice(i, i + 4).map(async (route) => {
      const response = await fetch(origin + route);
      const html = await response.text();
      const ok =
        response.status === (route === "/404" ? 404 : 200) &&
        html.includes("<h1") &&
        !html.includes("NEXT_HTTP_ERROR_FALLBACK;500");
      results.push({ route, status: response.status, ok });
      console.log(`${ok ? "PASS" : "FAIL"} ${response.status} ${route}`);
    }),
  );
}
const missing = await fetch(`${origin}/page-that-does-not-exist`);
results.push({
  route: "/page-that-does-not-exist",
  status: missing.status,
  ok: missing.status === 404,
});
console.log(
  `${missing.status === 404 ? "PASS" : "FAIL"} ${missing.status} unknown route`,
);
fs.mkdirSync("docs/qa", { recursive: true });
fs.writeFileSync("docs/qa/routes.json", JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
