// Old English public URLs and their Vietnamese replacements. next.config redirects
// the old ones (301); SEO settings in the admin stay keyed by the old path.
export const renamedPaths: Record<string, string> = {
  "/about": "/gioi-thieu",
  "/contact": "/lien-he",
  "/news": "/tin-tuc",
  "/our-work": "/thanh-qua",
  "/privacy": "/chinh-sach-bao-mat",
  "/terms": "/dieu-khoan-dich-vu",
};

/** Rewrites a link saved with an old English path (e.g. "/news/abc") to its new URL. */
export function localPath(href: string) {
  const [, base, rest = ""] = href.match(/^(\/[^/?#]+)(.*)$/) || [];
  return base && renamedPaths[base] ? renamedPaths[base] + rest : href;
}
