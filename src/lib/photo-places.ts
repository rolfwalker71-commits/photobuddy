import { humanLocationName } from "@/lib/place";
import type { Photo } from "@/lib/types";

/** Nominatim/Photon should only be asked a handful of times per request. */
export const PLACE_LOOKUP_CAP = 12;

export type PlaceLookup = (latitude: number, longitude: number) => Promise<string | null>;

const coordKey = (p: Photo) => `${(p.latitude as number).toFixed(3)}:${(p.longitude as number).toFixed(3)}`;

/**
 * Finds a place name for photos that have coordinates but no real name.
 * Lookups are sequential, de-duplicated by coordinates rounded to 3 decimals
 * and capped; failures are ignored. Returns the newly resolved names per photo id.
 */
export async function resolveMissingPlaces(
  photos: Photo[],
  lookup: PlaceLookup,
  cap = PLACE_LOOKUP_CAP,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const byKey = new Map<string, string | null>();
  let lookups = 0;
  for (const photo of photos) {
    if (humanLocationName(photo.location_name)) continue;
    if (!Number.isFinite(photo.latitude) || !Number.isFinite(photo.longitude)) continue;
    if (photo.latitude == null || photo.longitude == null) continue;
    const key = coordKey(photo);
    if (!byKey.has(key)) {
      if (lookups >= cap) continue;
      lookups += 1;
      let name: string | null = null;
      try {
        name = (await lookup(photo.latitude, photo.longitude))?.trim().slice(0, 120) || null;
      } catch {
        name = null;
      }
      byKey.set(key, name);
    }
    const name = byKey.get(key);
    if (name) resolved.set(photo.id, name);
  }
  return resolved;
}

/** `{photoId: place}` for every photo that has a real place name. */
export function placesMap(photos: Photo[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of photos) {
    const name = humanLocationName(p.location_name);
    if (name) out[p.id] = name;
  }
  return out;
}
