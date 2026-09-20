/**
 * Projecting a photo track onto a widget-sized canvas.
 *
 * The Scriptable script (src/lib/widget/script.ts) carries its own copy of
 * this — it ships as one standalone file and cannot import — so the two must
 * stay in step. The tests here are what guard the shared behaviour.
 */

export type TrackPoint = { lat: number; lon: number };

/** Web Mercator's y, in radians. */
export function mercatorY(lat: number) {
  const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

/**
 * Screen points for a track, scaled to fit and centred.
 *
 * Longitude is converted to radians like the latitude: mixing degrees with
 * Mercator's radians squashes a north–south route into a flat line.
 */
export function projectTrack(
  track: TrackPoint[],
  width: number,
  height: number,
  padding = 14,
) {
  const pts = track.map((p) => ({ x: (p.lon * Math.PI) / 180, y: mercatorY(p.lat) }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(Math.max(...xs) - minX, 1e-9);
  const spanY = Math.max(Math.max(...ys) - minY, 1e-9);

  // One scale for both axes, or the route comes out stretched.
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;

  return pts.map((p) => ({
    x: offX + (p.x - minX) * scale,
    y: height - offY - (p.y - minY) * scale,
  }));
}

/** Great-circle distance in kilometres. */
export function kmBetween(a: TrackPoint, b: TrackPoint) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function trackLength(track: TrackPoint[]) {
  let km = 0;
  for (let i = 1; i < track.length; i++) km += kmBetween(track[i - 1], track[i]);
  return km;
}

/** An SVG path for a projected track. */
export function trackPath(points: { x: number; y: number }[]) {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}
