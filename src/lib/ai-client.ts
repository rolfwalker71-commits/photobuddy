import type { Photo } from "@/lib/types";

/** Browser-side helpers for the OpenAI-backed endpoints (`/api/ai/*`). */

export const AI_UNAVAILABLE_FALLBACK =
  "Die KI-Funktionen sind nicht eingerichtet (OPENAI_API_KEY fehlt).";
export const AI_RATE_LIMIT_FALLBACK =
  "Zu viele KI-Anfragen. Bitte in ein paar Minuten erneut versuchen.";
/** Shortest query that is worth an AI search. */
export const AI_SEARCH_MIN_CHARS = 3;

export type AiDescription = {
  title: string;
  description: string;
  tags: string[];
};

/** `unavailable`: 503, the server has no OpenAI key. `rateLimited`: 429. */
export class AiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AiError";
    this.status = status;
  }

  get unavailable() {
    return this.status === 503;
  }

  get rateLimited() {
    return this.status === 429;
  }
}

/** The German message to show for a failed AI call; the server's own wins. */
export function aiErrorMessage(status: number, serverMessage?: string | null) {
  const message = serverMessage?.trim();
  if (message) return message;
  if (status === 503) return AI_UNAVAILABLE_FALLBACK;
  if (status === 429) return AI_RATE_LIMIT_FALLBACK;
  return `KI-Anfrage fehlgeschlagen (${status}).`;
}

async function postAi<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiError("Keine Verbindung zum Server.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AiError(aiErrorMessage(res.status, data.error), res.status);
  return data;
}

export async function describePhoto(photoId: string): Promise<AiDescription> {
  const data = await postAi<Partial<AiDescription>>("/api/ai/describe", { photoId });
  return {
    title: data.title?.trim() ?? "",
    description: data.description?.trim() ?? "",
    tags: cleanTags(data.tags ?? []),
  };
}

export async function searchPhotoIds(albumId: string, query: string): Promise<string[]> {
  const data = await postAi<{ photoIds?: string[] }>("/api/ai/search", {
    albumId,
    query: query.trim(),
  });
  return Array.isArray(data.photoIds) ? data.photoIds : [];
}

export async function writeRecapText(albumId: string): Promise<string> {
  const data = await postAi<{ text?: string }>("/api/ai/recap", { albumId });
  return data.text?.trim() ?? "";
}

/** Trim, drop a leading `#`, remove empties and case-insensitive duplicates. */
export function cleanTags(tags: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const name = raw.trim().replace(/^#+/, "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function canRunAiSearch(query: string) {
  return query.trim().length >= AI_SEARCH_MIN_CHARS;
}

/** Live fallback filter: every word must appear in title, description, place or a tag. */
export function matchesTextQuery(photo: Photo, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [
    photo.title,
    photo.description,
    photo.location_name,
    ...(photo.tags ?? []).map((tag) => tag.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((word) => hay.includes(word));
}

export type GallerySearch = { query: string; ids: Set<string> | null };

/**
 * Narrow photos by the gallery search: first to the AI result (ids) when there
 * is one, then by the plain text match on what is typed so far.
 */
export function applyGallerySearch(photos: Photo[], typed: string, ai: GallerySearch | null) {
  let result = photos;
  if (ai?.ids) {
    const ids = ai.ids;
    result = result.filter((photo) => ids.has(photo.id));
  }
  if (typed.trim()) result = result.filter((photo) => matchesTextQuery(photo, typed));
  return result;
}

export function aiSearchChipLabel(query: string, hits: number) {
  return `KI-Suche: ${query} · ${hits} Treffer`;
}

/** Text to share or copy for a recap. */
export function recapShareText(albumName: string, text: string) {
  return `${albumName}\n\n${text}`.trim();
}

/**
 * Body for `PATCH /api/photos/:id` when taking over an AI suggestion. The
 * endpoint nulls fields that are missing, so place and coordinates are carried
 * over from the photo; an empty suggestion keeps what is already there.
 */
export function describePatchBody(photo: Photo, suggestion: AiDescription) {
  return {
    title: suggestion.title.trim() || photo.title || null,
    description: suggestion.description.trim() || photo.description || null,
    location_name: photo.location_name,
    latitude: photo.latitude,
    longitude: photo.longitude,
  };
}
