import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SHARE_COOKIE,
  verifySession,
} from "@/lib/auth/session";
import { findUserById, isValidShareKey } from "@/lib/db/queries";
import { toProfile, type UserRow } from "@/lib/db/mappers";
import type { Profile } from "@/lib/types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unerwarteter Fehler.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function getSessionUser(): Promise<Profile | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await findUserById(payload.sub);
  if (!user || user.is_active === false) return null;
  return toProfile(user);
}

export async function getSessionUserRow(): Promise<UserRow | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await findUserById(payload.sub);
  if (!user || user.is_active === false) return null;
  return user;
}

export async function requireTeilnehmer() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Bitte zuerst anmelden.");
  return user;
}

export async function requireAdmin() {
  const user = await requireTeilnehmer();
  if (user.role !== "admin") {
    throw new HttpError(403, "Nur die Administration darf das.");
  }
  return user;
}

export function bearerMatchesAuthSecret(request: Request) {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && token === secret;
}

export function shareKeyFrom(request: Request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("key");
  if (fromQuery) return fromQuery;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|; )${SHARE_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function requireViewer(request: Request) {
  const user = await getSessionUser();
  if (user) return { mode: "teilnehmer" as const, user, shareKey: null };
  const key = shareKeyFrom(request);
  if (key && (await isValidShareKey(key))) {
    return { mode: "guest" as const, user: null, shareKey: key };
  }
  throw new HttpError(401, "Nicht berechtigt.");
}
