import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE } from "@/lib/preview";

export async function GET(request: Request) {
  (await draftMode()).disable();
  (await cookies()).delete(PREVIEW_COOKIE);
  const path = new URL(request.url).searchParams.get("path") || "/";
  redirect(/^\/(?!\/)[^\s]*$/.test(path) ? path : "/");
}
