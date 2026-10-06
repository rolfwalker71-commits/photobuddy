import { humanLocationName } from "@/lib/place";
import type { DayNote, Photo } from "@/lib/types";
import type { RecapStats } from "@/lib/recap";
import { noteForDay, photoDayKey } from "@/lib/chapters";
import { weatherLabel } from "@/lib/weather";

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

// --- report (travel-diary draft) ---

export const REPORT_MAX_PHOTOS = 30;
export const REPORT_VISION_PHOTOS = 12;
export const REPORT_LIMITS = { title: 80, intro: 300, text: 1500, caption: 140 } as const;

export const REPORT_LENGTHS = ["kurz", "mittel", "ausfuehrlich"] as const;
export type ReportLength = (typeof REPORT_LENGTHS)[number];
export const REPORT_DEFAULT_LENGTH: ReportLength = "mittel";
const REPORT_LENGTH_CONFIG: Record<
  ReportLength,
  { text: number; maxTokens: number; paragraphs: string }
> = {
  kurz: { text: 800, maxTokens: 1400, paragraphs: "ein bis zwei kurze, warme Absätze" },
  mittel: { text: 1500, maxTokens: 2000, paragraphs: "zwei bis vier kurze, warme Absätze" },
  ausfuehrlich: {
    text: 4000,
    maxTokens: 4500,
    paragraphs: "fünf bis acht Absätze mit je drei bis fünf Sätzen",
  },
};
export const REPORT_CONTEXT_MAX = 2000;
export const REPORT_NAME_MAX = 40;
export const REPORT_NAMES_MAX = 6;

/** Limits for a given length; `text` and `maxTokens` depend on it. */
export function reportLimits(length: ReportLength = REPORT_DEFAULT_LENGTH) {
  const c = REPORT_LENGTH_CONFIG[length];
  return { ...REPORT_LIMITS, text: c.text, maxTokens: c.maxTokens } as const;
}

export class ReportInputError extends Error {}

export type ReportExtras = {
  context: string;
  everyone: string[];
  people: Record<string, string[]>;
  length: ReportLength;
};

function cleanNames(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new ReportInputError(`${field} muss eine Liste von Vornamen sein.`);
  }
  const out: string[] = [];
  for (const raw of value as string[]) {
    const name = raw.replace(/\s+/g, " ").trim().slice(0, REPORT_NAME_MAX).trim();
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= REPORT_NAMES_MAX) break;
  }
  return out;
}

/** Validates and clamps the optional request fields; `ids` are the requested photo ids. */
export function parseReportExtras(
  body: { context?: unknown; everyone?: unknown; people?: unknown; length?: unknown },
  ids: string[],
): ReportExtras {
  if (body.context !== undefined && body.context !== null && typeof body.context !== "string") {
    throw new ReportInputError("context muss ein Text sein.");
  }
  const context = (typeof body.context === "string" ? body.context : "")
    .trim()
    .slice(0, REPORT_CONTEXT_MAX)
    .trim();
  const everyone = cleanNames(body.everyone, "everyone");
  const people: Record<string, string[]> = {};
  if (body.people !== undefined && body.people !== null) {
    if (typeof body.people !== "object" || Array.isArray(body.people)) {
      throw new ReportInputError("people muss ein Objekt {photoId: [Vornamen]} sein.");
    }
    const wanted = new Set(ids);
    for (const [id, names] of Object.entries(body.people as Record<string, unknown>)) {
      if (!wanted.has(id)) continue;
      people[id] = cleanNames(names, "people");
    }
  }
  let length: ReportLength = REPORT_DEFAULT_LENGTH;
  if (body.length !== undefined && body.length !== null) {
    if (!REPORT_LENGTHS.includes(body.length as ReportLength)) {
      throw new ReportInputError('length muss "kurz", "mittel" oder "ausfuehrlich" sein.');
    }
    length = body.length as ReportLength;
  }
  return { context, everyone, people, length };
}

/** A photo's own entry (even an empty list) overrides `everyone`. */
export function peopleForPhoto(
  id: string,
  everyone: string[] = [],
  people: Record<string, string[]> = {},
): string[] {
  return Object.prototype.hasOwnProperty.call(people, id) ? people[id] : everyone;
}

export type ReportPhoto = { id: string; caption: string };
export type ReportDraft = { title: string; intro: string; text: string; photos: ReportPhoto[] };

const swissSpelling = (s: string) => s.replace(/ß/g, "ss");

/** Only kind=photo, ordered by capture date (created_at when missing), stable for ties. */
export function reportPhotos(photos: Photo[]): Photo[] {
  return photos
    .filter((p) => p.kind === "photo")
    .map((p, i) => ({ p, i, t: Date.parse(p.taken_at ?? p.created_at) || 0 }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.p);
}

export type ReportInputExtras = {
  context?: string;
  everyone?: string[];
  people?: Record<string, string[]>;
  dayNotes?: DayNote[];
};

export function reportInput(photos: Photo[], title?: string, extras: ReportInputExtras = {}) {
  const context = extras.context?.trim();
  return {
    title: title?.trim().slice(0, 80) || undefined,
    ...(context ? { context } : {}),
    photos: photos.map((p, i) => {
      const names = peopleForPhoto(p.id, extras.everyone, extras.people);
      const note = extras.dayNotes ? noteForDay(extras.dayNotes, photoDayKey(p))?.body.trim() : "";
      const hasTemp = typeof p.weather_temp_c === "number" && Number.isFinite(p.weather_temp_c);
      const weather =
        p.weather_code != null || hasTemp
          ? [
              p.weather_code != null ? weatherLabel(p.weather_code) : null,
              hasTemp ? `${Math.round(p.weather_temp_c as number)} °C` : null,
            ]
              .filter(Boolean)
              .join(", ")
          : "";
      return {
        id: p.id,
        date: (p.taken_at ?? p.created_at).slice(0, 10),
        place: humanLocationName(p.location_name)?.slice(0, 80) ?? undefined,
        image: i < REPORT_VISION_PHOTOS ? "angehängt" : undefined,
        ...(names.length ? { personen: names } : {}),
        ...(note ? { tagesnotiz: note.slice(0, 600) } : {}),
        ...(weather ? { wetter: weather } : {}),
      };
    }),
  };
}

export function reportPrompt(length: ReportLength = REPORT_DEFAULT_LENGTH) {
  const limits = reportLimits(length);
  const cfg = REPORT_LENGTH_CONFIG[length];
  return (
    `Du hilfst, einen kurzen Reisetagebuch-Bericht für die Homepage einer Familie zu entwerfen. ` +
    `Antworte ausschliesslich mit JSON der Form {"title": string, "intro": string, "text": string, ` +
    `"photos": [{"id": string, "caption": string}]} auf Deutsch (Schweizer Rechtschreibung, «ss» statt «ß»). ` +
    `title: höchstens ${REPORT_LIMITS.title} Zeichen. intro: ein bis zwei Sätze, höchstens ${REPORT_LIMITS.intro} Zeichen. ` +
    `text: ${cfg.paragraphs} (durch Leerzeile getrennt), höchstens ${limits.text} Zeichen, ` +
    `chronologisch nach Datum. caption: pro Foto höchstens ${REPORT_LIMITS.caption} Zeichen, beschreibt, was sichtbar ist, ` +
    `und den Ort, ohne Datum. Nutze nur Angaben aus den Daten und was auf den Bildern zu sehen ist; ` +
    `erfinde keine Namen von Personen oder Orten und keine Ereignisse. ` +
    `Hat ein Foto keinen «place», darf für dieses Foto kein Ort genannt werden. ` +
    `Ortsnamen bleiben unverändert, werden mit «in» angeschlossen («Abend in Altdorf», nie «am Altdorf») und ` +
    `Kantonskürzel wie «UR» lässt du weg. Keine Superlative wie «perfekt» oder «traumhaft». Verwende nur die gegebenen Foto-IDs. ` +
    `Bilder sind in der Reihenfolge der Fotos mit «image: angehängt» beigefügt. ` +
    `Ist ein «context» vorhanden, ist das der eigene Bericht der Autorin oder des Autors: baue die Geschichte darauf auf, ` +
    `behalte Reihenfolge und Fakten bei und glätte nur die Formulierung; füge keine Ereignisse hinzu, die weder im Kontext, ` +
    `in einer «tagesnotiz» noch auf den Bildern zu sehen sind. «wetter» und «tagesnotiz» sind zusätzliche Fakten zu einem Foto. ` +
    `Personen: Nenne Personen NUR mit den Vornamen aus «personen» des jeweiligen Fotos, rate nie Namen und nenne niemanden, ` +
    `der nicht aufgeführt ist. Steht bei einem Foto keine «personen»-Angabe, behaupte nicht, wer darauf zu sehen ist. ` +
    `Schreibe in der Wir-Form der Familie, wenn der Kontext «wir» verwendet, sonst in einer neutralen Vergangenheitsform. ` +
    `Bildtexte dürfen die aufgeführten Personen nennen.`
  );
}

export function fallbackCaption(photo: Photo, title?: string) {
  const place = humanLocationName(photo.location_name);
  const base = place ?? (title?.trim() || "Reisefoto");
  return clampText(place && title?.trim() ? `${title.trim()}, ${place}` : base, REPORT_LIMITS.caption);
}

function clampParagraphs(value: unknown, max: number) {
  const s =
    typeof value === "string"
      ? value
          .split(/\n\s*\n/)
          .map((p) => p.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join("\n\n")
      : "";
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Validates ids against the requested photos, fills missing captions, keeps `photos` order. */
export function parseReport(
  text: string,
  photos: Photo[],
  title?: string,
  length: ReportLength = REPORT_DEFAULT_LENGTH,
): ReportDraft {
  const obj = parseJsonObject(text);
  if (!obj) throw new AiUpstreamError("Die KI-Antwort war nicht lesbar.");
  const captions = new Map<string, string>();
  if (Array.isArray(obj.photos)) {
    for (const item of obj.photos) {
      if (!item || typeof item !== "object") continue;
      const { id, caption } = item as { id?: unknown; caption?: unknown };
      if (typeof id !== "string" || captions.has(id)) continue;
      const c = swissSpelling(clampText(caption, REPORT_LIMITS.caption));
      if (c) captions.set(id, c);
    }
  }
  const draft: ReportDraft = {
    title: swissSpelling(clampText(obj.title, REPORT_LIMITS.title)),
    intro: swissSpelling(clampText(obj.intro, REPORT_LIMITS.intro)),
    text: swissSpelling(clampParagraphs(obj.text, reportLimits(length).text)),
    photos: photos.map((p) => ({
      id: p.id,
      caption: captions.get(p.id) ?? fallbackCaption(p, title),
    })),
  };
  if (!draft.text && !draft.intro) throw new AiUpstreamError("Die KI-Antwort war leer.");
  if (!draft.title) draft.title = clampText(title?.trim() || "Unser Reisebericht", REPORT_LIMITS.title);
  return draft;
}

export async function writeReport(input: {
  photos: Photo[]; // already filtered/sorted with reportPhotos()
  images: Map<string, { base64: string; mime: string }>;
  title?: string;
  length?: ReportLength;
  extras?: ReportInputExtras;
}): Promise<ReportDraft> {
  const length = input.length ?? REPORT_DEFAULT_LENGTH;
  const meta = reportInput(input.photos, input.title, input.extras);
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
  > = [{ type: "text", text: `Daten:\n${JSON.stringify(meta)}` }];
  input.photos.slice(0, REPORT_VISION_PHOTOS).forEach((p) => {
    const img = input.images.get(p.id);
    if (!img) return;
    parts.push({ type: "text", text: `Foto ${p.id}:` });
    parts.push({
      type: "image_url",
      image_url: { url: `data:${img.mime};base64,${img.base64}`, detail: "low" },
    });
  });
  const text = await chat(
    [
      { role: "system", content: reportPrompt(length) },
      { role: "user", content: parts },
    ],
    { json: true, maxTokens: reportLimits(length).maxTokens },
  );
  return parseReport(text, input.photos, input.title, length);
}
