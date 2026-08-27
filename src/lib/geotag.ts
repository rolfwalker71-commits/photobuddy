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
let lastApplied: GeoCoords | null = null;
const CACHE_MS = 4_000;
const WATCH_MS = 2_400;

export function clearDevicePositionCache() {
  cached = null;
}

export function rememberAppliedPosition(coords: GeoCoords) {
  lastApplied = coords;
}

function samePoint(a: GeoCoords, b: GeoCoords) {
  return (
    a.latitude.toFixed(5) === b.latitude.toFixed(5) &&
    a.longitude.toFixed(5) === b.longitude.toFixed(5)
  );
}

function fromPosition(pos: GeolocationPosition): GeoCoords {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}

function readOnce(force: boolean) {
  return new Promise<GeoCoords | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = fromPosition(pos);
        cached = { at: Date.now(), coords };
        resolve(coords);
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: force ? 0 : 4_000,
      },
    );
  });
}

function watchFresh(avoid: GeoCoords | null) {
  return new Promise<GeoCoords | null>((resolve) => {
    if (!navigator.geolocation.watchPosition) {
      void readOnce(true).then(resolve);
      return;
    }

    let best: { coords: GeoCoords; accuracy: number } | null = null;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = fromPosition(pos);
        const accuracy = pos.coords.accuracy || 9999;
        if (!best || accuracy < best.accuracy) {
          best = { coords, accuracy };
        }
        if (
          accuracy <= 40 &&
          (!avoid || !samePoint(coords, avoid))
        ) {
          window.clearTimeout(timer);
          navigator.geolocation.clearWatch(watchId);
          cached = { at: Date.now(), coords };
          resolve(coords);
        }
      },
      () => {
        window.clearTimeout(timer);
        navigator.geolocation.clearWatch(watchId);
        resolve(best?.coords ?? null);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );

    const timer = window.setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      const coords = best?.coords ?? null;
      if (coords) cached = { at: Date.now(), coords };
      resolve(coords);
    }, WATCH_MS);
  });
}

export async function readDevicePosition(force = false): Promise<GeoCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.coords;
  if (!force && inflight) return inflight;

  const request = force
    ? watchFresh(lastApplied)
    : readOnce(false);

  inflight = request;
  void request.finally(() => {
    if (inflight === request) inflight = null;
  });

  return request;
}

export function prefetchDevicePosition() {
  if (!isGeotaggingEnabled()) return;
  void readDevicePosition();
}
