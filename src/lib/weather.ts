import { getSiteUrl } from "@/lib/env";

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 500;

export type ArchiveWeather = {
  tempC: number;
  code: number;
};

function userAgent() {
  return `Photobuddy/1.0 (self-hosted family album; ${getSiteUrl()})`;
}

async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

function isoDateUtc(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function closestHour(
  times: string[],
  temps: Array<number | null | undefined>,
  codes: Array<number | null | undefined>,
  target: Date,
): ArchiveWeather | null {
  let best: ArchiveWeather | null = null;
  let bestDelta = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const stamp = new Date(times[i]);
    if (Number.isNaN(stamp.getTime())) continue;
    const temp = temps[i];
    const code = codes[i];
    if (typeof temp !== "number" || !Number.isFinite(temp)) continue;
    if (typeof code !== "number" || !Number.isFinite(code)) continue;
    const delta = Math.abs(stamp.getTime() - target.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      best = { tempC: Math.round(temp * 10) / 10, code: Math.round(code) };
    }
  }
  return best;
}

type HourlyPayload = {
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    weather_code?: Array<number | null>;
    weathercode?: Array<number | null>;
  };
};

async function fetchHourly(
  base: string,
  latitude: number,
  longitude: number,
  start: string,
  end: string,
): Promise<HourlyPayload | null> {
  await throttle();
  const url = new URL(base);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);
  url.searchParams.set("hourly", "temperature_2m,weather_code");
  url.searchParams.set("timezone", "GMT");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as HourlyPayload;
  } catch {
    return null;
  }
}

function weatherFromPayload(data: HourlyPayload | null, takenAt: Date) {
  const hourly = data?.hourly;
  if (!hourly?.time?.length) return null;
  const codes = hourly.weather_code ?? hourly.weathercode ?? [];
  return closestHour(hourly.time, hourly.temperature_2m ?? [], codes, takenAt);
}

/** Open-Meteo archive (historical) with forecast fallback for recent days. */
export async function fetchArchiveWeather(input: {
  latitude: number;
  longitude: number;
  takenAt: string;
}): Promise<ArchiveWeather | null> {
  const takenAt = new Date(input.takenAt);
  if (Number.isNaN(takenAt.getTime())) return null;
  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    return null;
  }

  const start = isoDateUtc(addUtcDays(takenAt, -1));
  const end = isoDateUtc(addUtcDays(takenAt, 1));
  const ageMs = Date.now() - takenAt.getTime();
  const useArchive = ageMs > 2 * 24 * 60 * 60 * 1000;

  if (useArchive) {
    const archived = weatherFromPayload(
      await fetchHourly(
        "https://archive-api.open-meteo.com/v1/archive",
        input.latitude,
        input.longitude,
        start,
        end,
      ),
      takenAt,
    );
    if (archived) return archived;
  }

  return weatherFromPayload(
    await fetchHourly(
      "https://api.open-meteo.com/v1/forecast",
      input.latitude,
      input.longitude,
      start,
      end,
    ),
    takenAt,
  );
}

export function weatherLabel(code: number | null | undefined) {
  if (code == null) return "Wetter";
  if (code === 0) return "Sonnig";
  if (code <= 3) return "Bewölkt";
  if (code === 45 || code === 48) return "Nebel";
  if (code >= 51 && code <= 67) return "Regen";
  if (code >= 71 && code <= 77) return "Schnee";
  if (code >= 80 && code <= 82) return "Schauer";
  if (code >= 85 && code <= 86) return "Schneeschauer";
  if (code >= 95) return "Gewitter";
  return "Bewölkt";
}

export function weatherTone(code: number | null | undefined): "sun" | "cloud" | "rain" | "snow" | "storm" {
  if (code == null) return "cloud";
  if (code === 0 || code === 1) return "sun";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  return "cloud";
}
