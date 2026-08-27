import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SHARE_COOKIE,
  shareCookieOptions,
  verifySession,
} from "@/lib/auth/session";

const AUTH_REQUIRED = [
  "/gallery",
  "/map",
  "/timeline",
  "/camera",
  "/settings",
  "/admin",
  "/photos",
];

function isProtected(pathname: string) {
  if (pathname.startsWith("/gallery/share")) return false;
  return AUTH_REQUIRED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isSecure(request: NextRequest) {
  return request.nextUrl.protocol === "https:";
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });

  const shareKey = request.nextUrl.searchParams.get("key");
  if (shareKey && pathname.startsWith("/gallery/share")) {
    response.cookies.set(
      SHARE_COOKIE,
      shareKey,
      shareCookieOptions(isSecure(request)),
    );
  }

  if (pathname.startsWith("/api/")) return response;

  const payload = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (isProtected(pathname) && !payload) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && payload) {
    const url = request.nextUrl.clone();
    url.pathname = "/gallery";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
