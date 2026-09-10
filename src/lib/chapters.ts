import { format } from "date-fns";
import { de } from "date-fns/locale";
import { humanLocationName } from "@/lib/image";
import type { DayNote, Photo } from "@/lib/types";

export function photoDayKey(photo: Photo) {
  return localDayKey(photo.taken_at ?? photo.created_at);
}

export function localDayKey(stamp: string) {
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return stamp.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseLocalDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return new Date(key);
  return new Date(y, m - 1, d);
}

function shortPlace(value: string | null | undefined) {
  const human = humanLocationName(value);
  if (!human) return null;
  const first = human.split(",")[0]?.trim();
  return first || human;
}

export function dominantPlace(photos: Photo[]) {
  const counts = new Map<string, number>();
  let first: string | null = null;
  for (const photo of photos) {
    const name = shortPlace(photo.location_name);
    if (!name) continue;
    if (!first) first = name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return first;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? first;
}

export function chapterHeading(dayKey: string, photos: Photo[]) {
  const place = dominantPlace(photos);
  let dateLabel = dayKey;
  try {
    dateLabel = format(parseLocalDay(dayKey), "d. MMMM", { locale: de });
  } catch {
    dateLabel = dayKey;
  }
  return place ? `${dateLabel} · ${place}` : dateLabel;
}

export function groupPhotosByDay(photos: Photo[], extraDays: string[] = []) {
  const groups = new Map<string, Photo[]>();
  for (const photo of photos) {
    const key = photoDayKey(photo);
    const list = groups.get(key) ?? [];
    list.push(photo);
    groups.set(key, list);
  }
  for (const day of extraDays) {
    if (day && !groups.has(day)) groups.set(day, []);
  }
  const days = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));
  return days.map((day) => ({
    day,
    heading: chapterHeading(day, groups.get(day) ?? []),
    photos: groups.get(day) ?? [],
  }));
}

export function noteForDay(notes: DayNote[], day: string) {
  return notes.find((note) => note.note_date.slice(0, 10) === day) ?? null;
}
