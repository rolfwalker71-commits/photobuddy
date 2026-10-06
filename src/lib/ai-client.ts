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

export type ReportDraft = {
  title: string;
  intro: string;
  text: string;
  photos: { id: string; caption: string }[];
  /** Place per photo id (only existing or freshly resolved names). */
  places: Record<string, string>;
};

/** Travel-diary draft for the selected photos (`POST /api/ai/report`). */
export async function writeReportDraft(
  albumId: string,
  photoIds: string[],
  title?: string,
): Promise<ReportDraft> {
  const data = await postAi<Partial<ReportDraft>>("/api/ai/report", {
    albumId,
    photoIds,
    language: "de",
    ...(title?.trim() ? { title: title.trim() } : {}),
  });
  return {
    title: data.title?.trim() ?? "",
    intro: data.intro?.trim() ?? "",
    text: data.text?.trim() ?? "",
    photos: Array.isArray(data.photos)
      ? data.photos
          .filter((p) => p && typeof p.id === "string")
          .map((p) => ({ id: p.id, caption: String(p.caption ?? "").trim() }))
      : [],
    places:
      data.places && typeof data.places === "object" && !Array.isArray(data.places)
        ? Object.fromEntries(
            Object.entries(data.places).filter(
              ([, v]) => typeof v === "string" && v.trim(),
            ),
          )
        : {},
  };
}

/** Fill only fields that are still empty; returns the new values. */
export function fillEmptyFields<T extends Record<string, string>>(current: T, draft: Partial<T>): T {
  const next = { ...current };
  for (const key of Object.keys(draft) as (keyof T)[]) {
    const value = draft[key];
    if (!current[key]?.trim() && typeof value === "string" && value.trim()) {
      next[key] = value as T[keyof T];
    }
  }
  return next;
}

/** Place of the first photo (in the given, chronological order) that has one. */
export function firstDraftPlace(photoIds: string[], places: Record<string, string>) {
  for (const id of photoIds) {
    const name = places[id]?.trim();
    if (name) return name;
  }
  return "";
}

/**
 * Body for `PATCH /api/photos/:id` when saving a caption. Everything not
 * edited (title, place, coordinates) is carried over because the endpoint
 * clears missing fields.
 */
export function captionPatchBody(photo: Photo, caption: string) {
  return {
    title: photo.title || null,
    description: caption.trim() || null,
    location_name: photo.location_name,
    latitude: photo.latitude,
    longitude: photo.longitude,
  };
}

/** Captions that differ from the photo's saved description. */
export function changedCaptions(photos: Photo[], captions: Record<string, string>) {
  return photos.filter((photo) => {
    const value = captions[photo.id];
    return value !== undefined && value.trim() !== (photo.description ?? "").trim();
  });
}
