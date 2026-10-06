import type { GravContextPost } from "@/lib/grav";

/**
 * Facts and style samples from the trip website for the publish dialog and the
 * AI report draft. Pure helpers (excerpt cleaning, previous post, trip window)
 * plus a loader with injectable Grav access and a small in-memory cache.
 */

export type TripStation = {
  name: string;
  country: string | null;
  arrival: string | null;
  departure: string | null;
  transport: string | null;
};
export type TripContext = { day: number | null; days: number | null; stations: TripStation[] };
export type StyleSample = { title: string; date: string; autor: string; excerpt: string };
export type PreviousPost = { title: string; date: string; intro: string };
export type PublishContext = {
  trip: TripContext | null;
  samples: StyleSample[];
  previous: PreviousPost | null;
};

export const EMPTY_PUBLISH_CONTEXT: PublishContext = { trip: null, samples: [], previous: null };

export const EXCERPT_MAX = 900;
export const MAX_SAMPLES = 2;
export const MAX_STATIONS = 6;
const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const CACHE_MS = 10 * 60 * 1000;
/** Route page + post list + two post bodies. */
export const MAX_GRAV_REQUESTS = 4;

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/;

/** "2026-10-24 22:40" / ISO → "2026-10-24T22:40" (wall clock as written); null if unreadable. */
export function normalizeLocal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(LOCAL_RE);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}`;
}

function localMs(local: string) {
  const m = local.match(LOCAL_RE);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
}

/** Plain text from a markdown/HTML post body, from the beginning, clamped at a word boundary. */
export function cleanExcerpt(source: string, max = EXCERPT_MAX): string {
  let t = String(source ?? "");
  t = t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ""); // front matter
  t = t.replace(/<!--[\s\S]*?-->/g, " ");
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " "); // images
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // links
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  t = t.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "");
  t = t.replace(/^\s*>\s?/gm, "");
  t = t.replace(/(\*\*|__|\*|_|~~|`)/g, "");
  // Keep paragraph breaks, collapse everything else.
  t = t
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.trimEnd()}…`;
}

type PostLike = Pick<GravContextPost, "route" | "title" | "date" | "published" | "autor">;

function byDateDesc<T extends PostLike>(posts: T[]) {
  return posts
    .map((post) => ({ post, at: normalizeLocal(post.date) }))
    .filter((x): x is { post: T; at: string } => x.at !== null)
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Published post with the latest date strictly before `date`. */
export function pickPrevious<T extends PostLike>(posts: T[], date: string): T | null {
  const limit = normalizeLocal(date);
  if (!limit) return null;
  return byDateDesc(posts.filter((p) => p.published)).find((x) => x.at < limit)?.post ?? null;
}

/** The author's newest published posts; any newest posts when the author has none. */
export function pickSampleCandidates<T extends PostLike>(
  posts: T[],
  autor: string,
  count = MAX_SAMPLES,
): T[] {
  const sorted = byDateDesc(posts.filter((p) => p.published)).map((x) => x.post);
  const key = autor.trim().toLowerCase();
  const own = key ? sorted.filter((p) => p.autor.trim().toLowerCase() === key) : [];
  return (own.length > 0 ? own : sorted).slice(0, count);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type RawStation = { ort?: unknown; land?: unknown; an?: unknown; ab?: unknown };
type RawLeg = { art?: unknown; von?: unknown; mit?: unknown; ab?: unknown };

/** Compact stations around `date` (±2 days, at most 6) plus Reisetag and total days. */
export function selectTrip(data: unknown, date: string): TripContext | null {
  const now = normalizeLocal(date);
  const raw = data as {
    start?: unknown;
    tage?: unknown;
    stationen?: unknown;
    strecken?: unknown;
  } | null;
  if (!now || !raw || typeof raw !== "object") return null;
  const nowMs = localMs(now);
  const total = typeof raw.tage === "number" && raw.tage > 0 ? Math.floor(raw.tage) : null;
  const startLocal = normalizeLocal(raw.start);
  let day: number | null = null;
  if (startLocal && total) {
    const n =
      Math.round((localMs(`${now.slice(0, 10)}T00:00`) - localMs(`${startLocal.slice(0, 10)}T00:00`)) / 86400000) + 1;
    day = n >= 1 && n <= total ? n : null;
  }
  const legs = (Array.isArray(raw.strecken) ? raw.strecken : []) as RawLeg[];
  const all = ((Array.isArray(raw.stationen) ? raw.stationen : []) as RawStation[])
    .map((s, index) => {
      const name = str(s?.ort);
      if (!name) return null;
      const arrival = normalizeLocal(s.an);
      const departure = normalizeLocal(s.ab);
      const from = arrival ?? departure;
      const to = departure ?? arrival;
      const leg =
        legs.find((l) => l.von === name && normalizeLocal(l.ab) === departure && departure) ??
        legs.find((l) => l.von === name);
      const transport = str(leg?.mit) ?? str(leg?.art);
      const station: TripStation = {
        name,
        country: str(s.land),
        arrival,
        departure,
        transport,
      };
      const a = from ? localMs(from) : NaN;
      const b = to ? localMs(to) : NaN;
      const distance = Number.isNaN(a) || Number.isNaN(b) ? Infinity : nowMs < a ? a - nowMs : nowMs > b ? nowMs - b : 0;
      return { station, a, b, distance, index };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const entries = all;

  let chosen = entries.filter((x) => x.distance <= WINDOW_MS);
  if (chosen.length < 2) {
    // Long sea legs: add the last station before and the next one after.
    const before = [...entries].reverse().find((x) => x.b < nowMs && !chosen.includes(x));
    const after = entries.find((x) => x.a > nowMs && !chosen.includes(x));
    chosen = [...chosen, ...(before ? [before] : []), ...(after ? [after] : [])];
  }
  chosen = [...chosen].sort((x, y) => x.distance - y.distance).slice(0, MAX_STATIONS);
  chosen.sort((x, y) => x.index - y.index);
  const stations = chosen.map((x) => x.station);
  if (day === null && total === null && stations.length === 0) return null;
  return { day, days: total, stations };
}

// --- loader ---

export type PublishContextDeps = {
  tripData: () => Promise<unknown | null>;
  posts: () => Promise<GravContextPost[]>;
  page: (route: string) => Promise<{
    header?: Record<string, unknown>;
    content?: string;
    date?: string | null;
    title?: string;
  } | null>;
  configured: () => boolean;
  now?: () => number;
};

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

export function resetPublishContextCache() {
  cache.clear();
}

/** Memoises a lookup for 10 minutes; failures are not kept. Counts only real fetches. */
function cached<T>(key: string, now: number, load: () => Promise<T>, counter: { n: number }) {
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.value as Promise<T>;
  counter.n += 1;
  const value = load();
  cache.set(key, { at: now, value });
  value.catch(() => cache.delete(key));
  return value;
}

async function safe<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

export async function loadPublishContext(
  autor: string,
  date: string,
  deps: PublishContextDeps,
): Promise<PublishContext> {
  if (!deps.configured() || !normalizeLocal(date)) return { ...EMPTY_PUBLISH_CONTEXT };
  const now = (deps.now ?? Date.now)();
  const counter = { n: 0 };
  const [tripData, posts] = await Promise.all([
    safe(() => cached("trip", now, deps.tripData, counter), null),
    safe(() => cached("posts", now, deps.posts, counter), [] as GravContextPost[]),
  ]);
  const trip = safe(async () => selectTrip(tripData, date), null);

  const previousPost = pickPrevious(posts, date);
  const candidates = pickSampleCandidates(posts, autor);
  // The list may already carry the body/intro; only fetch what is missing, within the budget.
  const needFetch: string[] = [];
  const want = (post: GravContextPost | null, needBody: boolean, needIntro: boolean) => {
    if (!post || needFetch.includes(post.route)) return;
    if ((needBody && !post.content) || (needIntro && !post.intro)) needFetch.push(post.route);
  };
  want(previousPost, false, true);
  for (const c of candidates) want(c, true, false);
  const budget = Math.max(0, MAX_GRAV_REQUESTS - counter.n);
  const pages = new Map<string, Awaited<ReturnType<PublishContextDeps["page"]>>>();
  const fetched = new Set<string>();
  for (const route of needFetch) {
    // Cached pages cost nothing; only uncached fetches count against the budget.
    const isCached = cache.has(`page:${route}`) && now - cache.get(`page:${route}`)!.at < CACHE_MS;
    if (!isCached && fetched.size >= budget) continue;
    if (!isCached) fetched.add(route);
    const page = await safe(
      () => cached(`page:${route}`, now, () => deps.page(route), { n: 0 }),
      null,
    );
    pages.set(route, page);
  }

  const body = (post: GravContextPost) => post.content || pages.get(post.route)?.content || "";
  const samples: StyleSample[] = [];
  for (const post of candidates) {
    const excerpt = cleanExcerpt(body(post));
    if (!excerpt) continue;
    const page = pages.get(post.route);
    samples.push({
      title: post.title,
      date: normalizeLocal(post.date) ?? "",
      autor: post.autor || String(page?.header?.autor ?? "").trim(),
      excerpt,
    });
  }
  let previous: PreviousPost | null = null;
  if (previousPost) {
    previous = {
      title: previousPost.title,
      date: normalizeLocal(previousPost.date) ?? "",
      intro: previousPost.intro || String(pages.get(previousPost.route)?.header?.intro ?? "").trim(),
    };
  }
  return { trip: await trip, samples, previous };
}
