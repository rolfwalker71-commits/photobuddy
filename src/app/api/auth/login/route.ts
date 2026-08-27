import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { jsonError, HttpError } from "@/lib/auth/request";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/db/queries";
import { toProfile } from "@/lib/db/mappers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    if (!email || !password) {
      throw new HttpError(400, "E-Mail und Passwort sind nötig.");
    }
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash ?? ""))) {
      throw new HttpError(401, "E-Mail oder Passwort ist falsch.");
    }
    const token = await signSession(user.id);
    const secure = new URL(request.url).protocol === "https:";
    const res = NextResponse.json({ user: toProfile(user) });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
