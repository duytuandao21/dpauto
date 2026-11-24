import type { MouseEvent } from "react";

/**
 * Click handler (capture phase) for a list page whose details open in the right-hand drawer:
 * links to a detail of this same page only push the URL (History API, synced by Next with
 * usePathname/useSearchParams) instead of navigating, so the page is not re-rendered or reloaded.
 */
export function softDetailLinks(isDetail: (url: URL) => boolean) {
  return (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as Element).closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement) || link.target) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || !isDetail(url)) return;
    // next/link skips its own navigation when the click was already handled.
    event.preventDefault();
    window.history.pushState(null, "", url.pathname + url.search);
  };
}
