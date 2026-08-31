const STORAGE_KEY = "photobuddy.currentAlbumId";

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
