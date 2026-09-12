const STORAGE_KEY = "photobuddy.currentAlbumId";
const ALBUMS_CACHE_KEY = "photobuddy.albumsCache";

export function getStoredAlbumId() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeAlbumId(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function pickAlbumId(
  albums: { id: string }[],
  preferred: string | null | undefined,
) {
  if (preferred && albums.some((album) => album.id === preferred)) {
    return preferred;
  }
  return albums[0]?.id ?? null;
}

/** Last album list, so the camera page can queue uploads while offline. */
export function cacheAlbums<T extends { id: string }>(albums: T[]) {
  try {
    window.localStorage.setItem(ALBUMS_CACHE_KEY, JSON.stringify(albums));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getCachedAlbums<T extends { id: string }>(): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALBUMS_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
