import { humanLocationName } from "@/lib/place";
import type { DayNote, Photo } from "@/lib/types";
import type { RecapStats } from "@/lib/recap";

/** OpenAI-backed helpers for the iOS app. All prompts live here; the key never leaves the server. */

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
export const AI_UNAVAILABLE_MESSAGE =
  "Die KI-Funktionen sind nicht eingerichtet (OPENAI_API_KEY fehlt).";
export const AI_RATE_LIMIT_MESSAGE =
  "Zu viele KI-Anfragen. Bitte in ein paar Minuten erneut versuchen.";

export function openaiConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

export function openaiModel(env: Record<string, string | undefined> = process.env) {
  return env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

// --- rate limit (in memory, per user) ---

const RATE_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT = 30;
const hits = new Map<string, number[]>();

/** True when the request is allowed (and counts it). */
export function allowAiRequest(userId: string, now = Date.now()) {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(userId, recent);
    return false;
  }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}

export function resetAiRateLimit() {
  hits.clear();
}

// --- OpenAI call (injectable) ---

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
    >;
export type ChatMessage = { role: "system" | "user"; content: ChatContent };
export type ChatFn = (
  messages: ChatMessage[],
  opts: { json: boolean; maxTokens: number },
) => Promise<string>;

export class AiUpstreamError extends Error {}

export const openaiChat: ChatFn = async (messages, opts) => {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AiUpstreamError(AI_UNAVAILABLE_MESSAGE);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: openaiModel(),
      messages,
      max_tokens: opts.maxTokens,
      temperature: 0.4,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new AiUpstreamError(`OpenAI antwortete mit Status ${res.status}.`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new AiUpstreamError("OpenAI lieferte keine Antwort.");
  return text;
};

let chat: ChatFn = openaiChat;
/** Test hook: replace the OpenAI call; pass null to restore. */
export function setAiChat(fn: ChatFn | null) {
  chat = fn ?? openaiChat;
}

// --- parsing helpers ---

export function parseJsonObject(text: string): Record<string, unknown> | null {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (fence) t = fence[1].trim();
  try {
    const v = JSON.parse(t);
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function clampText(value: unknown, max: number) {
  const s = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

// --- describe ---

export type PhotoDescription = { title: string; description: string; tags: string[] };

export function parseDescription(text: string): PhotoDescription {
  const obj = parseJsonObject(text);
  if (!obj) throw new AiUpstreamError("Die KI-Antwort war nicht lesbar.");
  const tags: string[] = [];
  if (Array.isArray(obj.tags)) {
    for (const raw of obj.tags) {
      if (typeof raw !== "string") continue;
      const tag = raw.replace(/^#/, "").trim().toLowerCase().slice(0, 30);
      if (tag && !tags.includes(tag)) tags.push(tag);
      if (tags.length === 6) break;
    }
  }
  const title = clampText(obj.title, 60);
  const description = clampText(obj.description, 200);
  if (!title && !description) {
    throw new AiUpstreamError("Die KI-Antwort war leer.");
  }
  return { title, description, tags };
}

export function describePrompt(language = "de") {
  const lang =
    language === "de"
      ? "Deutsch (Schweizer Rechtschreibung: «ss» statt «ß», z. B. «grösser»)"
      : language;
  return (
    `Du beschriftest ein Foto aus einem Reisetagebuch. Antworte ausschliesslich mit JSON ` +
    `der Form {"title": string, "description": string, "tags": string[]} auf ${lang}. ` +
    `title: höchstens 60 Zeichen, sachlich und freundlich. description: ein bis zwei Sätze, ` +
    `höchstens 200 Zeichen. tags: 3 bis 6 kurze Schlagwörter, kleingeschrieben, ohne «#». ` +
    `Beschreibe nur, was sichtbar ist; erfinde keine Namen von Personen oder Orten.`
  );
}

export async function describePhotoImage(input: {
  base64: string;
  mime: string;
  language?: string;
}): Promise<PhotoDescription> {
  const text = await chat(
    [
      { role: "system", content: describePrompt(input.language) },
      {
        role: "user",
        content: [
          { type: "text", text: "Beschreibe dieses Foto." },
          {
            type: "image_url",
            image_url: { url: `data:${input.mime};base64,${input.base64}`, detail: "low" },
          },
        ],
      },
    ],
    { json: true, maxTokens: 400 },
  );
  return parseDescription(text);
}

// --- search ---

export const SEARCH_MAX_RESULTS = 60;
const SEARCH_MAX_PHOTOS = 1500;

export function searchMetadata(photos: Photo[], uploaderNames: Map<string, string>) {
  return photos.slice(0, SEARCH_MAX_PHOTOS).map((p) => ({
    id: p.id,
    date: (p.taken_at ?? p.created_at).slice(0, 10),
    place: humanLocationName(p.location_name)?.slice(0, 80) ?? undefined,
    title: p.title?.slice(0, 80) || undefined,
    tags: p.tags?.length ? p.tags.map((t) => t.name) : undefined,
    by: uploaderNames.get(p.uploaded_by) || undefined,
    kind: p.kind === "video" ? "video" : undefined,
  }));
}

export function parseSearchIds(text: string, validIds: Set<string>) {
  const obj = parseJsonObject(text);
  if (!obj || !Array.isArray(obj.photoIds ?? obj.ids)) {
    throw new AiUpstreamError("Die KI-Antwort war nicht lesbar.");
  }
  const raw = (obj.photoIds ?? obj.ids) as unknown[];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id === "string" && validIds.has(id) && !out.includes(id)) out.push(id);
    if (out.length === SEARCH_MAX_RESULTS) break;
  }
  return out;
}

export async function searchPhotos(input: {
  query: string;
  photos: Photo[];
  uploaderNames: Map<string, string>;
}): Promise<string[]> {
  const meta = searchMetadata(input.photos, input.uploaderNames);
  const text = await chat(
    [
      {
        role: "system",
        content:
          `Du hilfst bei der Suche in einem Foto-Album. Du bekommst Metadaten der Fotos ` +
          `(id, date, place, title, tags, by = Hochgeladen von) und eine Suchanfrage auf Deutsch. ` +
          `Antworte ausschliesslich mit JSON {"photoIds": string[]}: die am besten passenden ` +
          `Foto-IDs, beste zuerst, höchstens ${SEARCH_MAX_RESULTS}. Verwende nur IDs aus den Daten. ` +
          `Passt nichts, gib eine leere Liste zurück.`,
      },
      {
        role: "user",
        content: `Suchanfrage: ${input.query}\n\nFotos:\n${JSON.stringify(meta)}`,
      },
    ],
    { json: true, maxTokens: 1500 },
  );
  return parseSearchIds(text, new Set(meta.map((m) => m.id)));
}

// --- recap ---

export function recapContext(
  albumName: string,
  stats: RecapStats,
  notes: DayNote[],
) {
  return {
    album: albumName,
    from: stats.date_from_label,
    to: stats.date_to_label,
    photos: stats.photo_count,
    videos: stats.video_count,
    places: stats.places,
    distance_km: stats.distance_km,
    busiest_day: stats.longest_day_label
      ? { day: stats.longest_day_label, count: stats.longest_day_count }
      : null,
    people: stats.people.map((p) => ({ name: p.name, count: p.photo_count + p.video_count })),
    weather: stats.weather.map((w) => w.label),
    temp_c: { min: stats.temp_min_c, max: stats.temp_max_c },
    day_notes: notes
      .slice(0, 30)
      .map((n) => ({ date: n.note_date.slice(0, 10), text: n.body.slice(0, 300) })),
  };
}

export function cleanRecapText(text: string) {
  return text.replace(/^["«»\s]+|["«»\s]+$/g, "").replace(/\n{3,}/g, "\n\n").slice(0, 1500);
}

export async function writeRecap(input: {
  albumName: string;
  stats: RecapStats;
  notes: DayNote[];
}): Promise<string> {
  const text = await chat(
    [
      {
        role: "system",
        content:
          `Du schreibst für ein Reisetagebuch eine warme, persönliche Zusammenfassung der Reise ` +
          `in 3 bis 5 Sätzen auf Deutsch (Schweizer Rechtschreibung, «ss» statt «ß»). ` +
          `Nutze nur die gelieferten Angaben, erfinde nichts dazu. Kein Titel, keine Aufzählung, ` +
          `kein Markdown, höchstens ein Emoji.`,
      },
      {
        role: "user",
        content: JSON.stringify(recapContext(input.albumName, input.stats, input.notes)),
      },
    ],
    { json: false, maxTokens: 500 },
  );
  const cleaned = cleanRecapText(text);
  if (!cleaned) throw new AiUpstreamError("Die KI-Antwort war leer.");
  return cleaned;
}
