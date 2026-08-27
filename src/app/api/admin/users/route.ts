import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { HttpError, jsonError } from "@/lib/auth/request";
import { toProfile } from "@/lib/db/mappers";
import { createUser, findUserByEmail } from "@/lib/db/queries";

function adminAuthorized(request: Request) {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && token === secret;
}

export async function POST(request: Request) {
  try {
    if (!adminAuthorized(request)) {
      throw new HttpError(401, "Nicht berechtigt.");
    }
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      display_name?: string;
      accent_color?: string;
    };
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    if (!email || !password) {
      throw new HttpError(400, "E-Mail und Passwort sind nötig.");
    }
    if (await findUserByEmail(email)) {
      throw new HttpError(409, "Diese E-Mail existiert schon.");
    }
    const user = await createUser({
      email,
      passwordHash: await hashPassword(password),
      displayName: body.display_name || email.split("@")[0],
      accentColor: body.accent_color,
    });
    if (!user) throw new HttpError(500, "Nutzer konnte nicht angelegt werden.");
    return NextResponse.json({ user: toProfile(user), email: user.email });
  } catch (err) {
    return jsonError(err);
  }
}
