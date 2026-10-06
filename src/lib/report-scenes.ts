import { humanLocationName } from "@/lib/place";
import type { Photo } from "@/lib/types";

/** Scenes of a (date-sorted) photo series for long reports. */

export const SCENE_GAP_MS = 3 * 60 * 60 * 1000;

export type ReportScene = {
  /** Local-looking stamp "YYYY-MM-DDTHH:mm" of the first and last photo. */
  from: string;
  to: string;
  place: string | null;
  photoIds: string[];
  people: string[];
};

const stamp = (p: Photo) => p.taken_at ?? p.created_at;
const ms = (p: Photo) => Date.parse(stamp(p)) || 0;

/** Zurich wall clock of a timestamp, "YYYY-MM-DDTHH:mm". */
export function sceneStamp(value: string, timeZone = "Europe/Zurich"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function placeOf(p: Photo) {
  return humanLocationName(p.location_name)?.slice(0, 80) ?? null;
}

/**
 * New scene when the gap to the previous photo exceeds 3 h or the place changes
 * (a photo without a place never splits a scene).
 */
export function groupScenes(
  photos: Photo[],
  peopleFor: (id: string) => string[] = () => [],
): ReportScene[] {
  const scenes: ReportScene[] = [];
  let last: Photo | null = null;
  let current: { photos: Photo[]; place: string | null } | null = null;
  const flush = () => {
    if (!current) return;
    const people: string[] = [];
    for (const p of current.photos) {
      for (const name of peopleFor(p.id)) if (!people.includes(name)) people.push(name);
    }
    scenes.push({
      from: sceneStamp(stamp(current.photos[0])),
      to: sceneStamp(stamp(current.photos[current.photos.length - 1])),
      place: current.place,
      photoIds: current.photos.map((p) => p.id),
      people,
    });
  };
  for (const p of photos) {
    const place = placeOf(p);
    const split =
      !current ||
      !last ||
      ms(p) - ms(last) > SCENE_GAP_MS ||
      (place !== null && current.place !== null && place !== current.place);
    if (split) {
      flush();
      current = { photos: [p], place };
    } else if (current) {
      current.photos.push(p);
      if (!current.place && place) current.place = place;
    }
    last = p;
  }
  flush();
  return scenes;
}

/**
 * Up to `max` photo ids spread evenly over the scenes, the first photo of each
 * scene first; chronological order. With more scenes than `max`, scenes are
 * sampled evenly.
 */
export function pickVisionIds(scenes: ReportScene[], max: number): string[] {
  if (scenes.length === 0 || max <= 0) return [];
  if (scenes.length >= max) {
    return Array.from({ length: max }, (_, i) => scenes[Math.floor((i * scenes.length) / max)].photoIds[0]);
  }
  const counts = scenes.map(() => 1);
  let left = max - scenes.length;
  while (left > 0) {
    let grew = false;
    for (let i = 0; i < scenes.length && left > 0; i++) {
      if (counts[i] < scenes[i].photoIds.length) {
        counts[i] += 1;
        left -= 1;
        grew = true;
      }
    }
    if (!grew) break;
  }
  const ids: string[] = [];
  scenes.forEach((scene, i) => {
    const size = scene.photoIds.length;
    for (let j = 0; j < counts[i]; j++) ids.push(scene.photoIds[Math.floor((j * size) / counts[i])]);
  });
  return ids;
}
