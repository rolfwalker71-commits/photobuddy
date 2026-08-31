import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SHARE_COOKIE,
  verifySession,
} from "@/lib/auth/session";
import {
  findUserById,
  getAlbumIdForShareKey,
  getPhoto,
  isAlbumMember,
} from "@/lib/db/queries";
import type { Photo } from "@/lib/types";
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

/** Teilnehmer/admin only. Share-link guests may view, comment, and react — not edit. */
export async function requireEditor(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer.mode === "guest" || !viewer.user) {
    throw new HttpError(403, "Gäste dürfen Fotodaten nicht ändern.");
  }
  return viewer.user;
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

export type Viewer =
  | { mode: "teilnehmer"; user: Profile; shareKey: null; albumId: string | null }
  | { mode: "guest"; user: null; shareKey: string; albumId: string };

export function albumIdFrom(request: Request) {
  return new URL(request.url).searchParams.get("albumId");
}

export async function requireViewer(request: Request): Promise<Viewer> {
  const user = await getSessionUser();
  if (user) return { mode: "teilnehmer", user, shareKey: null, albumId: null };
  const key = shareKeyFrom(request);
  if (key) {
    const albumId = await getAlbumIdForShareKey(key);
    if (albumId) {
      return { mode: "guest", user: null, shareKey: key, albumId };
    }
  }
  throw new HttpError(401, "Nicht berechtigt.");
}

export async function assertCanAccessAlbum(
  viewer: Viewer,
  albumId: string,
  opts?: { upload?: boolean },
) {
  if (viewer.mode === "guest") {
    if (opts?.upload) {
      throw new HttpError(403, "Gäste dürfen keine Fotos hochladen.");
    }
    if (viewer.albumId !== albumId) {
      throw new HttpError(403, "Kein Zugriff auf dieses Album.");
    }
    return;
  }
  if (viewer.user.role === "admin") return;
  if (!(await isAlbumMember(albumId, viewer.user.id))) {
    throw new HttpError(403, "Kein Zugriff auf dieses Album.");
  }
}

export async function requirePhotoAccess(request: Request, photoId: string) {
  const photo = await getPhoto(photoId);
  if (!photo) throw new HttpError(404, "Foto nicht gefunden.");
  const viewer = await requireViewer(request);
  await assertCanAccessAlbum(viewer, photo.album_id);
  return { viewer, photo };
}

export async function requirePhotoEditor(
  request: Request,
  photoId: string,
): Promise<{ user: Profile; photo: Photo }> {
  const { viewer, photo } = await requirePhotoAccess(request, photoId);
  if (viewer.mode === "guest" || !viewer.user) {
    throw new HttpError(403, "Gäste dürfen Fotodaten nicht ändern.");
  }
  return { user: viewer.user, photo };
}
