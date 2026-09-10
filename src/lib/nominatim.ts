const USER_AGENT = "Photobuddy/1.0 (reise-tagebuch; kontakt@example.local)";

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100;

async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
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
  };
  const name = data.display_name?.trim() || data.name?.trim();
  return name || null;
}
