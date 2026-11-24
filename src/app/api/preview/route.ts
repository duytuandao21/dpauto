import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE } from "@/lib/preview";

// Admin "Xem trước": turns on draft mode with a short-lived signed token from the backend,
// which publicFeed() forwards; the backend verifies it, so this route only stores it.
export async function GET(request: Request) {
  const url = new URL(request.url),
    token = url.searchParams.get("token") || "",
    path = url.searchParams.get("path") || "/";
  if (!/^[\w-]+\.[\w-]+$/.test(token) || token.length > 400)
    return new Response("Link xem trước không hợp lệ.", { status: 400 });
  const target =
    /^\/(?!\/)[^\s]*$/.test(path) && !path.startsWith("/admin") ? path : "/";
  (await draftMode()).enable();
  (await cookies()).set(PREVIEW_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: 30 * 60,
  });
  redirect(target);
}
