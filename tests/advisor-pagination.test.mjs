import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import renderer from "./helpers/service-ticket-render.cjs";

const { load } = renderer;
const { PageButtons } = load("components/manager/live-stock.tsx", {
  "next/navigation": {},
  "@/lib/api/client": {},
  "@/lib/api/use-page": {},
  "@/lib/api/stock-finance": {},
  "@/lib/api/workflow": {},
  "@/components/admin/auth-gate": {},
  "@/components/admin/primitives": {},
  "@/components/admin/admin-icon": { AdminIcon: () => null },
  "./manager-ui": {},
});

test("shared advisor pagination shows the visited page and keeps manager controls unchanged", () => {
  for (const previous of [[], ["", "cursor-1"]]) {
    let index = 0;
    const states = ["cursor-2", previous, [], "cursor-3", false, ""];
    const { useApiPage } = load("lib/api/use-page.ts", {
      react: {
        ...React,
        useEffect() {},
        useState: () => [states[index++], () => {}],
      },
      "./client": {},
    });
    const page = useApiPage("admin/notifications", 0);
    assert.equal(page.pageNumber, previous.length + 1);
    const html = renderToStaticMarkup(
      React.createElement(PageButtons, { page }),
    );
    assert.match(
      html,
      /<nav class="adv-pagination" aria-label="Phân trang danh sách">/,
    );
    assert.match(
      html,
      new RegExp(
        `aria-current="page" aria-live="polite">Trang ${previous.length + 1}`,
      ),
    );
    assert.match(html, /aria-label="Trang sau"/);
    assert.equal(
      html.includes('aria-label="Trang trước" disabled=""'),
      !previous.length,
    );
    const manager = renderToStaticMarkup(
      React.createElement(PageButtons, { page, manager: true }),
    );
    assert.match(manager, /class="mgr-pagination"/);
    assert.match(manager, />Trang trước<\/button>/);
    assert.doesNotMatch(manager, /adv-pagination-current/);
  }
});
