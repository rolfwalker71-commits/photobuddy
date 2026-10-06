import { humanLocationName } from "@/lib/place";
import type { DayNote, Photo } from "@/lib/types";
import type { RecapStats } from "@/lib/recap";
import { noteForDay, photoDayKey } from "@/lib/chapters";
import { weatherLabel } from "@/lib/weather";
import {
  groupScenes,
  pickVisionIds,
  sceneStamp,
  type ReportScene,
} from "@/lib/report-scenes";
import type { PublishContext } from "@/lib/publish-context";

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
  kurz: { text: 800, maxTokens: 1400, paragraphs: "ein bis zwei kurze Absätze" },
  mittel: { text: 1500, maxTokens: 2000, paragraphs: "zwei bis vier kurze Absätze" },
  ausfuehrlich: {
    text: 4000,
    maxTokens: 4500,
    paragraphs: "fünf bis acht Absätze mit je drei bis fünf Sätzen, bei vielen Szenen ein Absatz pro Szene",
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

export const REPORT_TONES = ["locker", "sachlich", "humorvoll"] as const;
export type ReportTone = (typeof REPORT_TONES)[number];
export const REPORT_DEFAULT_TONE: ReportTone = "locker";
export const REPORT_AUTHOR_MAX = 40;
export const REPORT_TRANSCRIPT_MAX = 800;
export const REPORT_TRANSCRIPTS_MAX = 8;
export const REFINE_LIMITS = { instruction: 300, title: 80, intro: 300, text: 4000 } as const;

export type ReportRefine = { title: string; intro: string; text: string; instruction: string };

export type ReportExtras = {
  context: string;
  everyone: string[];
  people: Record<string, string[]>;
  length: ReportLength;
  tone: ReportTone;
  autor: string;
  useStyle: boolean;
  transcripts: Record<string, string>;
  refine: ReportRefine | null;
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

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseRefine(value: unknown): ReportRefine | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ReportInputError("refine muss ein Objekt {title, intro, text, instruction} sein.");
  }
  const r = value as Record<string, unknown>;
  for (const key of ["title", "intro", "text", "instruction"]) {
    if (typeof r[key] !== "string") {
      throw new ReportInputError(`refine.${key} muss ein Text sein.`);
    }
  }
  const instruction = (r.instruction as string).trim().slice(0, REFINE_LIMITS.instruction).trim();
  if (!instruction) throw new ReportInputError("refine.instruction darf nicht leer sein.");
  return {
    title: (r.title as string).trim().slice(0, REFINE_LIMITS.title),
    intro: (r.intro as string).trim().slice(0, REFINE_LIMITS.intro),
    text: (r.text as string).trim().slice(0, REFINE_LIMITS.text),
    instruction,
  };
}

/** Validates and clamps the optional request fields; `ids` are the requested photo ids. */
export function parseReportExtras(
  body: {
    context?: unknown;
    everyone?: unknown;
    people?: unknown;
    length?: unknown;
    tone?: unknown;
    autor?: unknown;
    useStyle?: unknown;
    transcripts?: unknown;
    refine?: unknown;
  },
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
  let tone: ReportTone = REPORT_DEFAULT_TONE;
  if (body.tone !== undefined && body.tone !== null) {
    if (!REPORT_TONES.includes(body.tone as ReportTone)) {
      throw new ReportInputError('tone muss "locker", "sachlich" oder "humorvoll" sein.');
    }
    tone = body.tone as ReportTone;
  }
  if (body.autor !== undefined && body.autor !== null && typeof body.autor !== "string") {
    throw new ReportInputError("autor muss ein Text sein.");
  }
  const autor = (typeof body.autor === "string" ? body.autor : "")
    .trim()
    .slice(0, REPORT_AUTHOR_MAX);
  if (body.useStyle !== undefined && body.useStyle !== null && typeof body.useStyle !== "boolean") {
    throw new ReportInputError("useStyle muss true oder false sein.");
  }
  const useStyle = body.useStyle === false ? false : true;
  const transcripts: Record<string, string> = {};
  if (body.transcripts !== undefined && body.transcripts !== null) {
    if (typeof body.transcripts !== "object" || Array.isArray(body.transcripts)) {
      throw new ReportInputError("transcripts muss ein Objekt {YYYY-MM-DD: Text} sein.");
    }
    const entries = Object.entries(body.transcripts as Record<string, unknown>);
    for (const [, v] of entries) {
      if (typeof v !== "string") throw new ReportInputError("transcripts: Werte müssen Texte sein.");
    }
    for (const [day, v] of entries.sort(([a], [b]) => a.localeCompare(b))) {
      if (!DAY_KEY_RE.test(day)) continue;
      const t = (v as string).replace(/\s+/g, " ").trim().slice(0, REPORT_TRANSCRIPT_MAX).trim();
      if (!t) continue;
      transcripts[day] = t;
      if (Object.keys(transcripts).length >= REPORT_TRANSCRIPTS_MAX) break;
    }
  }
  const refine = parseRefine(body.refine);
  return { context, everyone, people, length, tone, autor, useStyle, transcripts, refine };
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
  tone?: ReportTone;
  /** Scenes for long series; put into the model input when given. */
  scenes?: ReportScene[];
  /** Photos whose image is attached; defaults to an even spread over the scenes. */
  visionIds?: string[];
  /** Spoken day notes, `YYYY-MM-DD` → text. */
  transcripts?: Record<string, string>;
  /** Style samples, previous post and trip facts from the website. */
  site?: PublishContext;
};

/** Scenes and the photos to attach as images (at most REPORT_VISION_PHOTOS, spread over the scenes). */
export function reportPlan(photos: Photo[], extras: ReportInputExtras = {}) {
  const scenes = groupScenes(photos, (id) => peopleForPhoto(id, extras.everyone, extras.people));
  return { scenes, visionIds: pickVisionIds(scenes, REPORT_VISION_PHOTOS) };
}

export function reportInput(photos: Photo[], title?: string, extras: ReportInputExtras = {}) {
  const context = extras.context?.trim();
  const vision = new Set(extras.visionIds ?? reportPlan(photos, extras).visionIds);
  const site = extras.site;
  const transcripts = Object.entries(extras.transcripts ?? {});
  return {
    title: title?.trim().slice(0, 80) || undefined,
    ...(context ? { context } : {}),
    ...(extras.tone ? { tone: extras.tone } : {}),
    ...(site?.trip
      ? {
          trip: {
            reisetag: site.trip.day ?? undefined,
            reisetage: site.trip.days ?? undefined,
            stationen: site.trip.stations.map((s) => ({
              ort: s.name,
              land: s.country ?? undefined,
              an: s.arrival ?? undefined,
              ab: s.departure ?? undefined,
              verkehrsmittel: s.transport ?? undefined,
            })),
          },
        }
      : {}),
    ...(site?.samples.length ? { samples: site.samples } : {}),
    ...(site?.previous ? { previous: site.previous } : {}),
    ...(transcripts.length
      ? { tage: transcripts.map(([datum, text]) => ({ datum, gesprochene_notiz: text })) }
      : {}),
    ...(extras.scenes?.length
      ? {
          scenes: extras.scenes.map((s) => ({
            from: s.from,
            to: s.to,
            place: s.place ?? undefined,
            photoIds: s.photoIds,
            people: s.people,
          })),
        }
      : {}),
    photos: photos.map((p) => {
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
        ...(extras.scenes?.length ? { time: sceneStamp(p.taken_at ?? p.created_at).slice(11) } : {}),
        place: humanLocationName(p.location_name)?.slice(0, 80) ?? undefined,
        image: vision.has(p.id) ? "angehängt" : undefined,
        ...(names.length ? { personen: names } : {}),
        ...(note ? { tagesnotiz: note.slice(0, 600) } : {}),
        ...(weather ? { wetter: weather } : {}),
      };
    }),
  };
}

const TONE_RULES: Record<ReportTone, string> = {
  locker: "Ton «locker»: herzlich und alltagsnah, wie man einer Freundin von dem Tag erzählt.",
  sachlich: "Ton «sachlich»: nüchtern und knapp, ohne Gefühlsausdrücke, nur was passiert ist.",
  humorvoll: "Ton «humorvoll»: leicht ironisch, mit trockenem Humor, aber nie albern und nie auf Kosten von Personen.",
};

const STYLE_RULES =
  `Schreibweise: immer Schweizer Rechtschreibung, nie «ß» (immer «ss», z. B. «grösser», «Strasse»), ` +
  `Anführungen in «Guillemets». ` +
  `Sprache wie bei einem echten Menschen, nicht wie eine KI: meist kurze, konkrete Sätze, Alltagswörter, ` +
  `abwechselnde Satzlängen. Verwende «wir», wenn «context» oder «samples» in der Wir-Form schreiben. ` +
  `Sind «samples» vorhanden, übernimm Rhythmus und Wortschatz dieser früheren Beiträge, ohne ihre Sätze zu kopieren. ` +
  `Ist ein «previous» (vorheriger Beitrag) vorhanden, wiederhole dessen Inhalt nicht und beginne, wenn es passt, so, dass es daran anknüpft. ` +
  `Verboten sind Floskeln und KI-Wendungen wie «unvergesslich», «eintauchen», «Abenteuer», «ein perfekter Tag», ` +
  `«voller Vorfreude», «Highlight», «Atmosphäre», «in vollen Zügen», ausserdem Superlative, rhetorische Fragen, ` +
  `Ausrufezeichen (höchstens eines im ganzen Text), Gedankenstrich-Ketten, Aufzählungen, Zwischenüberschriften, Emojis, ` +
  `Schlusssätze, die zusammenfassen («Alles in allem …»), und Wünsche oder Ausblicke, die nicht in den Notizen stehen.`;

const FACT_RULES =
  `NUR FAKTEN: Wetter nennst du nur, wenn es als «wetter» zu diesem Foto oder Tag gegeben ist oder auf dem Bild klar zu sehen ist. ` +
  `Orte nur aus «place» oder den Stationen in «trip». Uhrzeiten nur aus den gegebenen Daten. ` +
  `Tätigkeiten, Gefühle und Begleiter nur aus «context», den Tagesnotizen, den gesprochenen Notizen («gesprochene_notiz» in «tage») ` +
  `oder wenn sie auf den Bildern zu sehen sind. Ist etwas unbekannt, lass es weg, statt zu raten. ` +
  `Erfinde nie Namen, Gerichte, Fahrzeuge, Sehenswürdigkeiten oder Ereignisse.`;

export function reportPrompt(
  length: ReportLength = REPORT_DEFAULT_LENGTH,
  tone: ReportTone = REPORT_DEFAULT_TONE,
) {
  const limits = reportLimits(length);
  const cfg = REPORT_LENGTH_CONFIG[length];
  return (
    `Du hilfst, einen Reisetagebuch-Bericht für die Homepage einer Familie zu entwerfen. ` +
    `Antworte ausschliesslich mit JSON der Form {"title": string, "intro": string, "text": string, ` +
    `"photos": [{"id": string, "caption": string}]} auf Deutsch. ` +
    `title: höchstens ${REPORT_LIMITS.title} Zeichen, schlicht und konkret. intro: ein bis zwei Sätze, höchstens ${REPORT_LIMITS.intro} Zeichen. ` +
    `text: ${cfg.paragraphs} (durch Leerzeile getrennt), höchstens ${limits.text} Zeichen, ` +
    `chronologisch nach Datum. Ist «scenes» vorhanden, gliedere den Text nach diesen Szenen in der gegebenen Reihenfolge ` +
    `und fasse sehr kurze Szenen zusammen. caption: pro Foto höchstens ${REPORT_LIMITS.caption} Zeichen, beschreibt, was sichtbar ist, ` +
    `und den Ort, ohne Datum. Verwende nur die gegebenen Foto-IDs. ` +
    `${TONE_RULES[tone]} ${STYLE_RULES} ${FACT_RULES} ` +
    `Hat ein Foto keinen «place», darf für dieses Foto kein Ort genannt werden. ` +
    `Ortsnamen bleiben unverändert, werden mit «in» angeschlossen («Abend in Altdorf», nie «am Altdorf») und ` +
    `Kantonskürzel wie «UR» lässt du weg. ` +
    `Bilder sind in der Reihenfolge der Fotos mit «image: angehängt» beigefügt; die übrigen Fotos haben nur Metadaten. ` +
    `Ist ein «context» vorhanden, ist das der eigene Bericht der Autorin oder des Autors: baue die Geschichte darauf auf, ` +
    `behalte Reihenfolge und Fakten bei und glätte nur die Formulierung; füge keine Ereignisse hinzu, die weder im Kontext, ` +
    `in einer «tagesnotiz» noch auf den Bildern zu sehen sind. «wetter» und «tagesnotiz» sind zusätzliche Fakten zu einem Foto. ` +
    `Personen: Nenne Personen NUR mit den Vornamen aus «personen» des jeweiligen Fotos, rate nie Namen und nenne niemanden, ` +
    `der nicht aufgeführt ist. Steht bei einem Foto keine «personen»-Angabe, behaupte nicht, wer darauf zu sehen ist. ` +
    `Schreibe in der Wir-Form der Familie, wenn der Kontext «wir» verwendet, sonst in einer neutralen Vergangenheitsform. ` +
    `Bildtexte dürfen die aufgeführten Personen nennen.`
  );
}

export function reportRefinePrompt(
  length: ReportLength = REPORT_DEFAULT_LENGTH,
  tone: ReportTone = REPORT_DEFAULT_TONE,
) {
  const limits = reportLimits(length);
  return (
    `Du überarbeitest den Entwurf eines Reisetagebuch-Berichts nach einer Anweisung. ` +
    `Schreibe nicht von vorn: übernimm den gegebenen Entwurf («entwurf») und ändere nur, was die «anweisung» verlangt. ` +
    `Behalte alle Fakten, Namen, Orte und die Reihenfolge bei, ausser die Anweisung verlangt ausdrücklich etwas anderes; ` +
    `füge nichts hinzu, was nicht in «entwurf» oder den «daten» steht. ` +
    `Antworte ausschliesslich mit JSON der Form {"title": string, "intro": string, "text": string} auf Deutsch ` +
    `(Bildtexte brauchst du nicht zu liefern). title: höchstens ${REPORT_LIMITS.title} Zeichen, intro: höchstens ${REPORT_LIMITS.intro} Zeichen, ` +
    `text: Absätze durch Leerzeile getrennt, höchstens ${limits.text} Zeichen. ` +
    `${TONE_RULES[tone]} ${STYLE_RULES} ${FACT_RULES}`
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
  textMax?: number,
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
    text: swissSpelling(clampParagraphs(obj.text, textMax ?? reportLimits(length).text)),
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
  tone?: ReportTone;
  extras?: ReportInputExtras;
  /** Revise this draft instead of writing from scratch. */
  refine?: ReportRefine | null;
}): Promise<ReportDraft> {
  const length = input.length ?? REPORT_DEFAULT_LENGTH;
  const tone = input.tone ?? input.extras?.tone ?? REPORT_DEFAULT_TONE;
  const plan = reportPlan(input.photos, input.extras);
  const extras: ReportInputExtras = {
    ...input.extras,
    tone,
    scenes: input.extras?.scenes ?? plan.scenes,
    visionIds: input.extras?.visionIds ?? plan.visionIds,
  };
  const meta = reportInput(input.photos, input.title, extras);

  if (input.refine) {
    const r = input.refine;
    // A revision may keep a long draft long, whatever length was asked for.
    const textMax = Math.max(reportLimits(length).text, Math.min(REFINE_LIMITS.text, r.text.length + 300));
    const text = await chat(
      [
        { role: "system", content: reportRefinePrompt(length, tone) },
        {
          role: "user",
          content: JSON.stringify({
            entwurf: { title: r.title, intro: r.intro, text: r.text },
            anweisung: r.instruction,
            daten: { ...meta, scenes: undefined },
          }),
        },
      ],
      { json: true, maxTokens: reportLimits(length).maxTokens },
    );
    const draft = parseReport(text, input.photos, r.title || input.title, length, textMax);
    // The model may skip a field it did not touch.
    const obj = parseJsonObject(text);
    if (obj && typeof obj.intro !== "string") draft.intro = swissSpelling(clampText(r.intro, REPORT_LIMITS.intro));
    if (obj && typeof obj.text !== "string") draft.text = swissSpelling(clampParagraphs(r.text, textMax));
    return draft;
  }

  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
  > = [{ type: "text", text: `Daten:\n${JSON.stringify(meta)}` }];
  const visionSet = new Set(extras.visionIds);
  input.photos
    .filter((p) => visionSet.has(p.id))
    .slice(0, REPORT_VISION_PHOTOS)
    .forEach((p) => {
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
      { role: "system", content: reportPrompt(length, tone) },
      { role: "user", content: parts },
    ],
    { json: true, maxTokens: reportLimits(length).maxTokens },
  );
  return parseReport(text, input.photos, input.title, length);
}
