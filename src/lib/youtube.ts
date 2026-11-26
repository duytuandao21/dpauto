/** Video id of a YouTube link (watch, youtu.be, shorts, embed, live), or null. */
export function youtubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const id =
    host === "youtu.be"
      ? u.pathname.split("/")[1]
      : host === "youtube.com" || host === "youtube-nocookie.com"
        ? u.searchParams.get("v") ||
          u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1]
        : null;
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
