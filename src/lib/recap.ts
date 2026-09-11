import { photoDayKey } from "@/lib/chapters";
import { formatAppDate } from "@/lib/format-date";
import { humanLocationName } from "@/lib/image";
import type { Photo, Profile } from "@/lib/types";
import { weatherLabel, weatherTone } from "@/lib/weather";

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type RecapPerson = {
  user_id: string;
  name: string;
  photo_count: number;
  video_count: number;
};

export type RecapWeather = {
  code: number;
  label: string;
  tone: ReturnType<typeof weatherTone>;
  count: number;
};

export type RecapStats = {
  photo_count: number;
  video_count: number;
  media_count: number;
  unique_places: number;
  places: string[];
  date_from: string | null;
  date_to: string | null;
  date_from_label: string | null;
  date_to_label: string | null;
  longest_day: string | null;
  longest_day_label: string | null;
  longest_day_count: number;
  distance_km: number | null;
  people: RecapPerson[];
  weather: RecapWeather[];
  temp_min_c: number | null;
  temp_max_c: number | null;
};

export function buildRecapStats(
  photos: Photo[],
  profiles: Profile[],
): RecapStats {
  const names = new Map(profiles.map((p) => [p.id, p.display_name]));
  const peopleMap = new Map<string, RecapPerson>();
  const places = new Set<string>();
  const days = new Map<string, number>();
  const weatherMap = new Map<number, number>();
  const points: Array<{ t: number; latitude: number; longitude: number }> = [];
  let tempMin: number | null = null;
  let tempMax: number | null = null;
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  let photoCount = 0;
  let videoCount = 0;

  for (const photo of photos) {
    const isVideo = photo.kind === "video";
    if (isVideo) videoCount += 1;
    else photoCount += 1;

    const person = peopleMap.get(photo.uploaded_by) ?? {
      user_id: photo.uploaded_by,
      name: names.get(photo.uploaded_by) || "Unbekannt",
      photo_count: 0,
      video_count: 0,
    };
    if (isVideo) person.video_count += 1;
    else person.photo_count += 1;
    peopleMap.set(photo.uploaded_by, person);

    const place = humanLocationName(photo.location_name);
    if (place) places.add(place);

    const day = photoDayKey(photo);
    days.set(day, (days.get(day) ?? 0) + 1);

    const stamp = photo.taken_at ?? photo.created_at;
    if (!dateFrom || stamp < dateFrom) dateFrom = stamp;
    if (!dateTo || stamp > dateTo) dateTo = stamp;

    if (photo.weather_code != null) {
      weatherMap.set(photo.weather_code, (weatherMap.get(photo.weather_code) ?? 0) + 1);
    }
    if (photo.weather_temp_c != null) {
      tempMin =
        tempMin == null ? photo.weather_temp_c : Math.min(tempMin, photo.weather_temp_c);
      tempMax =
        tempMax == null ? photo.weather_temp_c : Math.max(tempMax, photo.weather_temp_c);
    }
    if (photo.latitude != null && photo.longitude != null) {
      points.push({
        t: new Date(stamp).getTime(),
        latitude: photo.latitude,
        longitude: photo.longitude,
      });
    }
  }

  let longestDay: string | null = null;
  let longestCount = 0;
  for (const [day, count] of days) {
    if (count > longestCount) {
      longestDay = day;
      longestCount = count;
    }
  }

  points.sort((a, b) => a.t - b.t);
  let distance = 0;
  let hops = 0;
  for (let i = 1; i < points.length; i += 1) {
    const km = haversineKm(points[i - 1], points[i]);
    if (km > 0.03 && km < 800) {
      distance += km;
      hops += 1;
    }
  }

  const weather = [...weatherMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([code, count]) => ({
      code,
      label: weatherLabel(code),
      tone: weatherTone(code),
      count,
    }));

  return {
    photo_count: photoCount,
    video_count: videoCount,
    media_count: photos.length,
    unique_places: places.size,
    places: [...places].slice(0, 8),
    date_from: dateFrom,
    date_to: dateTo,
    date_from_label: dateFrom ? formatAppDate(dateFrom) : null,
    date_to_label: dateTo ? formatAppDate(dateTo) : null,
    longest_day: longestDay,
    longest_day_label: longestDay ? formatAppDate(longestDay) : null,
    longest_day_count: longestCount,
    distance_km: hops > 0 ? Math.round(distance * 10) / 10 : null,
    people: [...peopleMap.values()].sort(
      (a, b) => b.photo_count + b.video_count - (a.photo_count + a.video_count),
    ),
    weather,
    temp_min_c: tempMin == null ? null : Math.round(tempMin),
    temp_max_c: tempMax == null ? null : Math.round(tempMax),
  };
}
