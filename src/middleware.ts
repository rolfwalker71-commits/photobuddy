import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // api/photos$ bleibt aussen vor: Next.js puffert Bodies von Middleware-Treffern
    // und kappt sie bei 10 MB ("Failed to parse body as FormData" beim Hochladen).
    "/((?!api/photos$|_next/static|_next/image|favicon.ico|sw.js|runtime-config.js|icons/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
