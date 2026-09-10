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
  if (!locality?.trim()) return null;
  const place = locality.trim();
  const code = cantonNameToCode(address.state);
  if (code) return `${place} ${code}`;
  const region = address.state ?? address.county;
  if (region?.trim()) return `${place}, ${region.trim()}`;
  const country = address.country?.trim();
  if (country) return `${place}, ${country}`;
  return place;
}

/** Build Nominatim `q` strings for Swiss place names (e.g. "Altdorf UR"). */
export function buildForwardGeocodeQueries(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1]?.toUpperCase() ?? "";
  const cantonName = SWISS_CANTON_NAMES[lastToken];

  if (tokens.length >= 2 && cantonName) {
    const locality = tokens.slice(0, -1).join(" ");
    return [
      `${locality}, ${cantonName}, Switzerland`,
      `${locality}, ${cantonName}, Schweiz`,
      `${locality}, ${cantonName}`,
    ];
  }

  return [trimmed];
}

type NominatimSearchRow = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
};

async function nominatimSearch(query: string, limit = 5): Promise<NominatimSearchRow[]> {
  await throttle();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("accept-language", "de");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimSearchRow[];
  return Array.isArray(data) ? data : [];
}

function rowToHit(row: NominatimSearchRow): GeocodeHit | null {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const label =
    formatFromAddress(row.address) ??
    row.name?.trim() ??
    row.display_name?.trim() ??
    null;
  if (!label) return null;
  return { latitude, longitude, label };
}

export async function forwardGeocode(rawQuery: string): Promise<GeocodeHit[]> {
  const queries = buildForwardGeocodeQueries(rawQuery);
  if (!queries.length) return [];

  const seen = new Set<string>();
  const hits: GeocodeHit[] = [];

  for (const query of queries) {
    const rows = await nominatimSearch(query, 8);
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

  return hits.slice(0, 8);
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  await throttle();
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "14");
  url.searchParams.set("accept-language", "de");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    display_name?: string;
    name?: string;
    address?: Record<string, string>;
  };
  return (
    formatFromAddress(data.address) ??
    data.name?.trim() ??
    data.display_name?.trim() ??
    null
  );
}
