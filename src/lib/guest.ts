const NAME_KEY = "photobuddy.guestName";
const SESSION_KEY = "photobuddy.guestSession";
const NAME_COOKIE = "photobuddy_guest_name";
const SESSION_COOKIE = "photobuddy_guest_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

const nameListeners = new Set<(name: string) => void>();

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function persist(key: string, cookie: string, value: string) {
  window.localStorage.setItem(key, value);
  writeCookie(cookie, value);
}

export function getGuestSessionId() {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY) || readCookie(SESSION_COOKIE);
  if (!id) {
    id = crypto.randomUUID();
  }
  persist(SESSION_KEY, SESSION_COOKIE, id);
  return id;
}

export function getStoredGuestName() {
  if (typeof window === "undefined") return "";
  const fromLs = window.localStorage.getItem(NAME_KEY);
  if (fromLs?.trim()) return fromLs.trim();
  const fromCookie = readCookie(NAME_COOKIE).trim();
  if (fromCookie) {
    window.localStorage.setItem(NAME_KEY, fromCookie);
    return fromCookie;
  }
  return "";
}

export function hasGuestName() {
  return getStoredGuestName().length >= 2;
}

export function storeGuestName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) return;
  persist(NAME_KEY, NAME_COOKIE, trimmed);
  for (const listener of nameListeners) listener(trimmed);
}

export function subscribeGuestName(listener: (name: string) => void) {
  nameListeners.add(listener);
  return () => {
    nameListeners.delete(listener);
  };
}
