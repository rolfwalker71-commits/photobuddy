const USER_AGENT = "Photobuddy/1.0 (reise-tagebuch; kontakt@example.local)";

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100;

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

async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

function formatFromAddress(address: Record<string, string> | undefined): string | null {
  if (!address) return null;
  const locality =
    address.village ??
    address.town ??
    address.city ??
    address.municipality ??
    address.hamlet ??
    address.suburb;
  if (locality?.trim()) {
    const place = locality.trim();
    const code = cantonNameToCode(address.state);
    if (code) return `${place} ${code}`;
    const region = address.state ?? address.county;
    if (region?.trim()) return `${place}, ${region.trim()}`;
    const country = address.country?.trim();
    if (country) return `${place}, ${country}`;
    return place;
  }
  const region = address.state ?? address.county ?? address.region;
  if (region?.trim()) {
    const country = address.country?.trim();
    if (country && country.toLowerCase() !== region.trim().toLowerCase()) {
      return `${region.trim()}, ${country}`;
    }
    return region.trim();
  }
  const country = address.country?.trim();
  if (country) return country;
  return null;
}

function pushQuery(queries: string[], seen: Set<string>, q: string) {
  const trimmed = q.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  queries.push(trimmed);
}

/** Build Nominatim `q` strings — Swiss canton hints plus worldwide fallbacks. */
export function buildForwardGeocodeQueries(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const queries: string[] = [];
  const seen = new Set<string>();

  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1]?.toUpperCase() ?? "";
  const cantonName = SWISS_CANTON_NAMES[lastToken];

  if (tokens.length >= 2 && cantonName) {
    const locality = tokens.slice(0, -1).join(" ");
    pushQuery(queries, seen, `${locality}, ${cantonName}, Switzerland`);
    pushQuery(queries, seen, `${locality}, ${cantonName}, Schweiz`);
    pushQuery(queries, seen, `${locality}, ${cantonName}`);
    pushQuery(queries, seen, `${locality} ${lastToken}, Switzerland`);
  }

  pushQuery(queries, seen, trimmed);

  if (tokens.length >= 2 && cantonName) {
    pushQuery(queries, seen, tokens.slice(0, -1).join(" "));
  }

  const looksSwiss =
    (tokens.length >= 2 && cantonName != null) ||
    /,\s*(schweiz|switzerland|suisse|svizzera)\b/i.test(trimmed);
  if (!trimmed.includes(",") && (looksSwiss || tokens.length === 1)) {
    pushQuery(queries, seen, `${trimmed}, Switzerland`);
  }

  return queries;
}

type NominatimSearchRow = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
};

type NominatimSearchResponse = {
  rows: NominatimSearchRow[];
  nominatimError: string | null;
};

async function readNominatimError(res: Response): Promise<string> {
  const text = (await res.text()).trim();
  if (!text) return `HTTP ${res.status}`;
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

async function nominatimSearch(query: string, limit = 5): Promise<NominatimSearchResponse> {
  await throttle();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("accept-language", "de");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) {
    return { rows: [], nominatimError: await readNominatimError(res) };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { rows: [], nominatimError: "Nominatim-Antwort ungültig (JSON)." };
  }
  const rows = Array.isArray(data) ? (data as NominatimSearchRow[]) : [];
  return { rows, nominatimError: null };
}

function shortDisplayName(displayName: string): string {
  const parts = displayName
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return displayName.trim();
  return parts.slice(0, 2).join(", ");
}

function rowToHit(row: NominatimSearchRow): GeocodeHit | null {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const displayName = row.display_name?.trim();
  const label =
    formatFromAddress(row.address) ??
    row.name?.trim() ??
    (displayName ? shortDisplayName(displayName) : null);
  if (!label) return null;
  return { latitude, longitude, label };
}

export async function forwardGeocode(rawQuery: string): Promise<ForwardGeocodeResult> {
  const queries = buildForwardGeocodeQueries(rawQuery);
  if (!queries.length) return { results: [], nominatimError: null };

  const seen = new Set<string>();
  const hits: GeocodeHit[] = [];
  let lastError: string | null = null;

  for (const query of queries) {
    const { rows, nominatimError } = await nominatimSearch(query, 8);
    if (nominatimError) lastError = nominatimError;
    for (const row of rows) {
      const hit = rowToHit(row);
      if (!hit) continue;
      const key = `${hit.latitude.toFixed(5)}:${hit.longitude.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(hit);
    }
    if (hits.length > 0) break;
  }

  return {
    results: hits.slice(0, 8),
    nominatimError: hits.length > 0 ? null : lastError,
  };
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { place: null, nominatimError: null };
  }
  await throttle();
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "14");
  url.searchParams.set("accept-language", "de");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) {
    return { place: null, nominatimError: await readNominatimError(res) };
  }
  let data: {
    display_name?: string;
    name?: string;
    address?: Record<string, string>;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { place: null, nominatimError: "Nominatim-Antwort ungültig (JSON)." };
  }
  const place =
    formatFromAddress(data.address) ??
    data.name?.trim() ??
    data.display_name?.trim() ??
    null;
  return { place, nominatimError: null };
}
