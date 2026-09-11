import { humanLocationName } from "@/lib/place";

/** Pure helpers for the evening push summary (see src/lib/digest.ts). */

export const DEFAULT_DIGEST_HOUR = 20;
export const DEFAULT_DIGEST_TIME_ZONE = "Europe/Zurich";

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function parseDigestHour(value: unknown) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null;
}

/** Calendar date (YYYY-MM-DD) and hour (0–23) at `now` in `timeZone`. */
export function localDateAndHour(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
  };
}

export type DigestRow = {
  uploaded_by: string;
  author_name: string | null;
  location_name: string | null;
};

export type DigestSummary = {
  count: number;
  authors: string[];
  places: string[];
};

/** Counts, most active uploaders first, and up to three distinct places. */
export function summarizeDigest(
  rows: DigestRow[],
  excludeUploaderId: string | null = null,
): DigestSummary {
  const mine = rows.filter((row) => row.uploaded_by !== excludeUploaderId);
  const byAuthor = new Map<string, number>();
  const places: string[] = [];
  for (const row of mine) {
    const name = row.author_name?.trim() || "Unbekannt";
    byAuthor.set(name, (byAuthor.get(name) ?? 0) + 1);
    const place = humanLocationName(row.location_name)?.split(",")[0]?.trim();
    if (place && !places.includes(place) && places.length < 3) places.push(place);
  }
  const authors = [...byAuthor.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .map(([name]) => name);
  return { count: mine.length, authors, places };
}

export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3) {
    return `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;
  }
  const rest = names.length - 3;
  return `${names.slice(0, 3).join(", ")} und ${rest} weiteren`;
}

export function digestBody(summary: DigestSummary) {
  const noun = summary.count === 1 ? "neue Aufnahme" : "neue Aufnahmen";
  let text = `Heute ${summary.count} ${noun}`;
  if (summary.authors.length > 0) text += ` von ${joinNames(summary.authors)}`;
  if (summary.places.length > 0) text += ` · ${summary.places.join(", ")}`;
  return text;
}
