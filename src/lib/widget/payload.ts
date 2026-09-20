import { randomBytes } from "node:crypto";
import {
  getAlbum,
  listAlbums,
  listAlbumsForUser,
  listPhotos,
  listProfiles,
  setWidgetToken,
} from "@/lib/db/queries";
import type { UserRow } from "@/lib/db/mappers";
import type { Album, Photo, Profile } from "@/lib/types";
import { parseWidgetSettings, type WidgetSettings } from "@/lib/widget/settings";

/** Newest photos the widget may show. Enough for the 16-tile iPad collage. */
const PHOTO_LIMIT = 24;
/** Points on the route line. More than this is invisible at widget size. */
const TRACK_LIMIT = 180;

export type WidgetPhoto = {
  id: string;
  takenAt: string | null;
  place: string | null;
  author: string;
  authorColor: string;
  title: string | null;
  isHighlight: boolean;
  isVideo: boolean;
  tempC: number | null;
  weatherCode: number | null;
  lat: number | null;
  lon: number | null;
  /** Relative, so the script can prefix whichever address it was set up with. */
  thumb: string;
  image: string;
};

export type WidgetPayload = {
  version: 1;
  generatedAt: string;
  settings: WidgetSettings;
  album: {
    id: string;
    name: string;
    /** 1-based day of the trip, or null when no start date is known. */
    day: number | null;
    days: number | null;
    startsOn: string | null;
    endsOn: string | null;
  } | null;
  albums: { id: string; name: string }[];
  stats: {
    total: number;
    today: number;
    week: number;
    contributors: { name: string; color: string; count: number }[];
    place: string | null;
  };
  photos: WidgetPhoto[];
  track: { lat: number; lon: number }[];
  openUrl: string;
};

export async function ensureWidgetToken(user: UserRow) {
  if (user.widget_token) return user.widget_token;
  return rotateWidgetToken(user.id);
}

export async function rotateWidgetToken(userId: string) {
  return setWidgetToken(userId, randomBytes(24).toString("base64url"));
}

function ymd(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dayNumber(album: Album, now: Date) {
  const start = album.starts_on ?? album.derived_starts_on;
  if (!start) return { day: null, days: null };
  const startMs = Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(startMs)) return { day: null, days: null };
  const todayMs = Date.parse(`${ymd(now)}T00:00:00Z`);
  const day = Math.floor((todayMs - startMs) / 86_400_000) + 1;

  const end = album.ends_on ?? album.derived_ends_on;
  const endMs = end ? Date.parse(`${end}T00:00:00Z`) : NaN;
  const days = Number.isFinite(endMs)
    ? Math.floor((endMs - startMs) / 86_400_000) + 1
    : null;

  return { day: day > 0 ? day : null, days };
}

/** Everything the Scriptable script draws, for one album, in one response. */
export async function widgetPayload(
  user: UserRow,
  settings: WidgetSettings,
  now = new Date(),
): Promise<WidgetPayload> {
  const visible =
    user.role === "admin" ? await listAlbums() : await listAlbumsForUser(user.id);

  const chosen = settings.albumId
    ? ((await getAlbum(settings.albumId)) ?? null)
    : null;
  // A member can lose access to the album they picked; fall back rather than
  // leaving the widget empty.
  const album =
    chosen && visible.some((a) => a.id === chosen.id) ? chosen : (visible[0] ?? null);

  if (!album) {
    return {
      version: 1,
      generatedAt: now.toISOString(),
      settings,
      album: null,
      albums: [],
      stats: { total: 0, today: 0, week: 0, contributors: [], place: null },
      photos: [],
      track: [],
      openUrl: "/gallery",
    };
  }

  const [all, profiles] = await Promise.all([listPhotos(album.id), listProfiles()]);
  const byId = new Map<string, Profile>(profiles.map((p) => [p.id, p]));

  const when = (photo: Photo) => photo.taken_at ?? photo.created_at;
  const sorted = [...all].sort(
    (a, b) => Date.parse(when(b) ?? "") - Date.parse(when(a) ?? ""),
  );
  const shown = settings.onlyHighlights
    ? sorted.filter((photo) => photo.is_highlight)
    : sorted;

  const today = ymd(now);
  const weekAgo = Date.parse(today) - 6 * 86_400_000;
  let todayCount = 0;
  let weekCount = 0;
  const counts = new Map<string, number>();
  for (const photo of all) {
    const stamp = when(photo);
    if (!stamp) continue;
    if (stamp.slice(0, 10) === today) todayCount += 1;
    if (Date.parse(stamp.slice(0, 10)) >= weekAgo) weekCount += 1;
    counts.set(photo.uploaded_by, (counts.get(photo.uploaded_by) ?? 0) + 1);
  }

  const contributors = [...counts.entries()]
    .map(([id, count]) => ({
      name: byId.get(id)?.display_name ?? "Unbekannt",
      color: byId.get(id)?.accent_color ?? "#0f766e",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const photos: WidgetPhoto[] = shown.slice(0, PHOTO_LIMIT).map((photo) => ({
    id: photo.id,
    takenAt: when(photo),
    place: photo.location_name,
    author: byId.get(photo.uploaded_by)?.display_name ?? "Unbekannt",
    authorColor: byId.get(photo.uploaded_by)?.accent_color ?? "#0f766e",
    title: photo.title,
    isHighlight: photo.is_highlight,
    isVideo: photo.kind === "video",
    tempC: photo.weather_temp_c,
    weatherCode: photo.weather_code,
    lat: photo.latitude,
    lon: photo.longitude,
    thumb: `/api/widget/photo/${photo.id}?size=thumb`,
    image: `/api/widget/photo/${photo.id}?size=full`,
  }));

  // The route is drawn oldest → newest, from every located photo in the album
  // (not only the ones the widget lists), thinned to what a widget can show.
  const located = [...all]
    .filter((photo) => photo.latitude != null && photo.longitude != null)
    .sort((a, b) => Date.parse(when(a) ?? "") - Date.parse(when(b) ?? ""));
  const step = Math.max(1, Math.ceil(located.length / TRACK_LIMIT));
  const track = located
    .filter((_, index) => index % step === 0 || index === located.length - 1)
    .map((photo) => ({ lat: photo.latitude as number, lon: photo.longitude as number }));

  return {
    version: 1,
    generatedAt: now.toISOString(),
    settings,
    album: { id: album.id, name: album.name, ...dayNumber(album, now), startsOn: album.starts_on, endsOn: album.ends_on },
    albums: visible.map((a) => ({ id: a.id, name: a.name })),
    stats: {
      total: all.length,
      today: todayCount,
      week: weekCount,
      contributors,
      place: sorted.find((photo) => photo.location_name)?.location_name ?? null,
    },
    photos,
    track,
    openUrl: "/gallery",
  };
}

export function settingsOf(user: UserRow) {
  return parseWidgetSettings(user.widget_settings);
}
