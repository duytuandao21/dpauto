"use client";
import { useEffect, useRef, useState } from "react";
import type { TocItem } from "@/lib/article-toc";

/**
 * Article table of contents: a sticky side box on desktop, a collapsible box above
 * the article on tablet/phone. Highlights the section the reader has reached.
 */
export function ArticleToc({
  items,
  variant,
}: {
  items: TocItem[];
  variant: "side" | "inline";
}) {
  const [active, setActive] = useState(items[0]?.id);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // The section whose heading last passed under the sticky header is the one being read.
      let current = items[0]?.id;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= 140) current = item.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [items]);

  const links = items.map((item) => (
    <a
      key={item.id}
      href={`#${item.id}`}
      data-level={item.level}
      aria-current={active === item.id ? "location" : undefined}
      onClick={() => details.current?.removeAttribute("open")}
    >
      {item.text}
    </a>
  ));

  if (variant === "inline")
    return (
      <details ref={details} className="other-services article-toc-inline">
        <summary>Nội dung bài viết</summary>
        <nav aria-label="Nội dung bài viết">{links}</nav>
      </details>
    );
  return (
    <aside className="article-toc-side">
      <nav className="other-services" aria-label="Nội dung bài viết">
        <h3>Nội dung</h3>
        <div className="article-toc-list">{links}</div>
      </nav>
    </aside>
  );
}
