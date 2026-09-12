/** Day-by-day travel route from photo GPS, for the map's route layer. */

/** Distinct, readable on light and satellite tiles; cycles after eight days. */
export const ROUTE_COLORS = [
  "#0f766e",
  "#c2410c",
  "#7c3aed",
  "#be123c",
  "#0369a1",
  "#a16207",
  "#15803d",
  "#db2777",
] as const;

type RoutePhoto = {
  latitude: number;
  longitude: number;
  taken_at: string | null;
  created_at: string;
};

export type DayRoute = {
  day: string;
  color: string;
  points: [number, number][];
  /** Straight-line sum between consecutive photos, not the road distance. */
  distanceKm: number;
};

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: [number, number], b: [number, number]) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * One polyline per day, oldest day first. Colours follow the day's position
 * in the trip, so day 1 keeps its colour when later days are added.
 */
export function buildDayRoutes<T extends RoutePhoto>(
  photos: T[],
  dayKey: (photo: T) => string,
): DayRoute[] {
  const byDay = new Map<string, T[]>();
  for (const photo of photos) {
    const key = dayKey(photo);
    const list = byDay.get(key) ?? [];
    list.push(photo);
    byDay.set(key, list);
  }
  return [...byDay.keys()].sort().map((day, index) => {
    const points: [number, number][] = [];
    const sorted = [...(byDay.get(day) ?? [])].sort((a, b) =>
      (a.taken_at ?? a.created_at).localeCompare(b.taken_at ?? b.created_at),
    );
    for (const photo of sorted) {
      const last = points[points.length - 1];
      if (last && last[0] === photo.latitude && last[1] === photo.longitude) continue;
      points.push([photo.latitude, photo.longitude]);
    }
    let distanceKm = 0;
    for (let i = 1; i < points.length; i += 1) {
      distanceKm += haversineKm(points[i - 1], points[i]);
    }
    return {
      day,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
      points,
      distanceKm,
    };
  });
}

export type DayBridge = {
  fromDay: string;
  toDay: string;
  color: string;
  points: [[number, number], [number, number]];
  distanceKm: number;
};

/**
 * The hop between days: last photo of one day to the first of the next. Drawn
 * dashed on the map, because nobody photographed that stretch — it closes the
 * gap the per-day lines leave open. Carries the arriving day's colour, so a
 * bridge points at where the next day begins. Days without any located photo
 * are skipped rather than breaking the chain.
 */
export function buildDayBridges(routes: DayRoute[]): DayBridge[] {
  const located = routes.filter((route) => route.points.length > 0);
  const bridges: DayBridge[] = [];
  for (let i = 1; i < located.length; i += 1) {
    const from = located[i - 1];
    const to = located[i];
    const start = from.points[from.points.length - 1];
    const end = to.points[0];
    if (start[0] === end[0] && start[1] === end[1]) continue;
    bridges.push({
      fromDay: from.day,
      toDay: to.day,
      color: to.color,
      points: [start, end],
      distanceKm: haversineKm(start, end),
    });
  }
  return bridges;
}

export function formatKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${new Intl.NumberFormat("de-CH", {
    maximumFractionDigits: km < 10 ? 1 : 0,
  }).format(km)} km`;
}
