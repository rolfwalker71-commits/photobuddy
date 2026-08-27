const STORAGE_KEY = "photobuddy.geotagging";

export type GeoCoords = {
  latitude: number;
  longitude: number;
};

const listeners = new Set<(enabled: boolean) => void>();

export function isGeotaggingEnabled() {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

export function setGeotaggingEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
  for (const listener of listeners) listener(enabled);
}

export function subscribeGeotagging(listener: (enabled: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let inflight: Promise<GeoCoords | null> | null = null;
let cached: { at: number; coords: GeoCoords } | null = null;
const CACHE_MS = 45_000;

export async function readDevicePosition(force = false): Promise<GeoCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.coords;
  if (inflight) return inflight;

  const request = new Promise<GeoCoords | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        cached = { at: Date.now(), coords };
        resolve(coords);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
    );
  });
  inflight = request;
  void request.finally(() => {
    inflight = null;
  });

  return inflight;
}

export function prefetchDevicePosition() {
  if (!isGeotaggingEnabled()) return;
  void readDevicePosition();
}
