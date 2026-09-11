const lsKey = (albumId: string) => `photobuddy.lastSeen.${albumId}`;
const cookieName = (albumId: string) => `photobuddy_ls_${albumId}`;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function readLocalLastSeen(albumId: string) {
  if (typeof window === "undefined") return null;
  try {
    const fromLs = window.localStorage.getItem(lsKey(albumId));
    if (fromLs) return fromLs;
  } catch {
    /* ignore */
  }
  return readCookie(cookieName(albumId)) || null;
}

export function writeLocalLastSeen(albumId: string, iso: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(albumId), iso);
  } catch {
    /* ignore */
  }
  writeCookie(cookieName(albumId), iso);
}

/** New since the last visit — your own uploads never count as new. */
export function isPhotoNew(
  photo: { created_at: string; uploaded_by: string },
  lastSeenAt: string | null,
  viewerId: string | null = null,
) {
  if (!lastSeenAt) return false;
  if (viewerId && photo.uploaded_by === viewerId) return false;
  return photo.created_at > lastSeenAt;
}
