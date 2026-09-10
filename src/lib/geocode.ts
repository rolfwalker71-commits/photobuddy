import { getSiteUrl } from "@/lib/env";

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 400;

const FRIENDLY_SEARCH_ERROR =
  "Ortssuche vorübergehend nicht erreichbar. Bitte später erneut versuchen.";
const FRIENDLY_REVERSE_ERROR =
  "Ortsvorschlag vorübergehend nicht erreichbar. Bitte später erneut versuchen.";

/** ISO 3166-2:CH — two-letter canton codes */
export const SWISS_CANTON_NAMES: Record<string, string> = {
  AG: "Aargau",
  AI: "Appenzell Innerrhoden",
  AR: "Appenzell Ausserrhoden",
  BE: "Bern",
  BL: "Basel-Landschaft",
  BS: "Basel-Stadt",
  FR: "Freiburg",
  GE: "Genf",
  GL: "Glarus",
  GR: "Graubünden",
  JU: "Jura",
  LU: "Luzern",
  NE: "Neuenburg",
  NW: "Nidwalden",
  OW: "Obwalden",
  SG: "St. Gallen",
  SH: "Schaffhausen",
  SO: "Solothurn",
  SZ: "Schwyz",
  TG: "Thurgau",
  TI: "Tessin",
  UR: "Uri",
  VD: "Waadt",
  VS: "Wallis",
  ZG: "Zug",
  ZH: "Zürich",
};

const CANTON_SUFFIX = new RegExp(
  `\\s+(${Object.keys(SWISS_CANTON_NAMES).join("|")})$`,
  "i",
);

const cantonNameToCode = (() => {
  const map = new Map<string, string>();
  for (const [code, name] of Object.entries(SWISS_CANTON_NAMES)) {
    map.set(name.toLowerCase(), code);
    map.set(`kanton ${name.toLowerCase()}`, code);
    map.set(code.toLowerCase(), code);
  }
  map.set("freiburg/fribourg", "FR");
  map.set("genève", "GE");
  map.set("genf", "GE");
  map.set("graubünden/grisons", "GR");
  map.set("grisons", "GR");
  map.set("ticino", "TI");
  map.set("tessin", "TI");
  map.set("valais/wallis", "VS");
  map.set("vaud", "VD");
  map.set("waadt", "VD");
  return (state: string | undefined): string | null => {
    if (!state?.trim()) return null;
    const key = state.trim().toLowerCase();
    return map.get(key) ?? null;
  };
})();

export type GeocodeHit = {
  latitude: number;
  longitude: number;
  label: string;
};

export type ForwardGeocodeResult = {
  results: GeocodeHit[];
  nominatimError: string | null;
};

export type ReverseGeocodeResult = {
  place: string | null;
  nominatimError: string | null;
};

function userAgent(): string {
  return `Photobuddy/1.0 (self-hosted family album; ${getSiteUrl()})`;
}

async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

function pushQuery(queries: string[], seen: Set<string>, q: string) {
  const trimmed = q.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  queries.push(trimmed);
}

/** Build search `q` strings — Swiss canton hints plus worldwide fallbacks. */
export function buildForwardGeocodeQueries(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const queries: string[] = [];
  const seen = new Set<string>();

  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1]?.toUpperCase() ?? "";
  const cantonName = SWISS_CANTON_NAMES[lastToken];

  pushQuery(queries, seen, trimmed);

  if (tokens.length >= 2 && cantonName) {
    const locality = tokens.slice(0, -1).join(" ");
    pushQuery(queries, seen, `${locality}, ${cantonName}`);
    pushQuery(queries, seen, `${locality}, ${cantonName}, Switzerland`);
    pushQuery(queries, seen, `${locality}, ${cantonName}, Schweiz`);
    pushQuery(queries, seen, `${locality} ${lastToken}, Switzerland`);
    pushQuery(queries, seen, locality);
  }

  const looksSwiss =
    (tokens.length >= 2 && cantonName != null) ||
    /,\s*(schweiz|switzerland|suisse|svizzera)\b/i.test(trimmed);
  if (!trimmed.includes(",") && (looksSwiss || tokens.length === 1)) {
    pushQuery(queries, seen, `${trimmed}, Switzerland`);
  }

  return queries;
}

function cleanCountry(country?: string, countrycode?: string): string | null {
  if (countrycode?.toUpperCase() === "CH") return null;
  const c = country?.trim();
  if (c && !c.includes("/")) return c;
  return countrycode?.trim() || null;
}

function withRegion(
  place: string,
  state: string | undefined,
  country: string | undefined,
  countrycode: string | undefined,
): string {
  const code = cantonNameToCode(state);
  if (code) {
    if (CANTON_SUFFIX.test(place)) return place;
    return `${place} ${code}`;
  }
  const region = state?.trim();
  if (region && region.toLowerCase() !== place.toLowerCase()) {
    return `${place}, ${region}`;
  }
  const niceCountry = cleanCountry(country, countrycode);
  if (niceCountry && niceCountry.toLowerCase() !== place.toLowerCase()) {
    return `${place}, ${niceCountry}`;
  }
  return place;
}

type PhotonProperties = {
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  locality?: string;
  district?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
};

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: PhotonProperties;
};

function photonLocality(props: PhotonProperties, preferCity: boolean): string | null {
  const order = preferCity
    ? [props.city, props.name, props.locality, props.district, props.county]
    : [props.name, props.city, props.locality, props.district, props.county];
  for (const value of order) {
    if (value?.trim()) return value.trim();
  }
  return null;
}

function formatPhotonLabel(props: PhotonProperties | undefined, preferCity: boolean): string | null {
  if (!props) return null;
  const locality = photonLocality(props, preferCity);
  if (locality) {
    return withRegion(locality, props.state, props.country, props.countrycode);
  }
  const region = props.state ?? props.county;
  if (region?.trim()) {
    const country = cleanCountry(props.country, props.countrycode);
    if (country && country.toLowerCase() !== region.trim().toLowerCase()) {
      return `${region.trim()}, ${country}`;
    }
    return region.trim();
  }
  return cleanCountry(props.country, props.countrycode);
}

function photonFeatureToHit(feature: PhotonFeature, preferCity = false): GeocodeHit | null {
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const longitude = Number(coords[0]);
  const latitude = Number(coords[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const label = formatPhotonLabel(feature.properties, preferCity);
  if (!label) return null;
  return { latitude, longitude, label };
}

function parsePhotonFeatures(data: unknown): PhotonFeature[] {
  if (!data || typeof data !== "object") return [];
  const features = (data as { features?: unknown }).features;
  return Array.isArray(features) ? (features as PhotonFeature[]) : [];
}

async function fetchJson(
  url: string,
  friendlyError: string,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  await throttle();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: friendlyError };
    }
    try {
      return { ok: true, data: await res.json() };
    } catch {
      return { ok: false, error: friendlyError };
    }
  } catch {
    return { ok: false, error: friendlyError };
  }
}

type ProviderSearchResult = {
  hits: GeocodeHit[];
  error: string | null;
};

async function photonSearch(query: string, limit = 8): Promise<ProviderSearchResult> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "de");

  const res = await fetchJson(url.toString(), FRIENDLY_SEARCH_ERROR);
  if (!res.ok) return { hits: [], error: res.error };

  const hits: GeocodeHit[] = [];
  const seen = new Set<string>();
  for (const feature of parsePhotonFeatures(res.data)) {
    const hit = photonFeatureToHit(feature, false);
    if (!hit) continue;
    const key = `${hit.latitude.toFixed(5)}:${hit.longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(hit);
  }
  return { hits, error: null };
}

type OpenMeteoRow = {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  country_code?: string;
  admin1?: string;
};

async function openMeteoSearch(query: string, limit = 8): Promise<ProviderSearchResult> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", String(limit));
  url.searchParams.set("language", "de");
  url.searchParams.set("format", "json");

  const res = await fetchJson(url.toString(), FRIENDLY_SEARCH_ERROR);
  if (!res.ok) return { hits: [], error: res.error };

  const rows = (res.data as { results?: OpenMeteoRow[] } | null)?.results;
  if (!Array.isArray(rows)) return { hits: [], error: null };

  const hits: GeocodeHit[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const name = row.name?.trim();
    if (!name) continue;
    const label = withRegion(name, row.admin1, row.country, row.country_code);
    const key = `${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ latitude, longitude, label });
  }
  return { hits, error: null };
}

function mergeHits(target: GeocodeHit[], incoming: GeocodeHit[], seen: Set<string>) {
  for (const hit of incoming) {
    const key = `${hit.latitude.toFixed(5)}:${hit.longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(hit);
  }
}

export async function forwardGeocode(rawQuery: string): Promise<ForwardGeocodeResult> {
  const queries = buildForwardGeocodeQueries(rawQuery);
  if (!queries.length) return { results: [], nominatimError: null };

  const seen = new Set<string>();
  const hits: GeocodeHit[] = [];
  let lastError: string | null = null;

  for (const query of queries) {
    const { hits: found, error } = await photonSearch(query, 8);
    if (error) lastError = error;
    mergeHits(hits, found, seen);
    if (hits.length > 0) {
      return { results: hits.slice(0, 8), nominatimError: null };
    }
  }

  for (const query of queries) {
    const { hits: found, error } = await openMeteoSearch(query, 8);
    if (error) lastError = error;
    mergeHits(hits, found, seen);
    if (hits.length > 0) {
      return { results: hits.slice(0, 8), nominatimError: null };
    }
  }

  return {
    results: [],
    nominatimError: lastError,
  };
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { place: null, nominatimError: null };
  }

  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("lang", "de");
  url.searchParams.set("limit", "1");

  const res = await fetchJson(url.toString(), FRIENDLY_REVERSE_ERROR);
  if (!res.ok) {
    return { place: null, nominatimError: res.error };
  }

  const feature = parsePhotonFeatures(res.data)[0];
  if (!feature) return { place: null, nominatimError: null };

  const place = formatPhotonLabel(feature.properties, true);
  return { place, nominatimError: null };
}
