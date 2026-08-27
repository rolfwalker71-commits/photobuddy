const NAME_KEY = "photobuddy.guestName";
const SESSION_KEY = "photobuddy.guestSession";

export function getGuestSessionId() {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getStoredGuestName() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function storeGuestName(name: string) {
  window.localStorage.setItem(NAME_KEY, name.trim());
}
