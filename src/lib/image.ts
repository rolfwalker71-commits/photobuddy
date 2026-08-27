import imageCompression from "browser-image-compression";
import exifr from "exifr";

export type PhotoExif = {
  takenAt: string | null;
  latitude: number | null;
  longitude: number | null;
};

function asFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dmsToDecimal(dms: unknown, ref: unknown): number | null {
  if (!Array.isArray(dms) || dms.length < 2) return null;
  const [deg, min = 0, sec = 0] = dms.map((part) => Number(part));
  if (![deg, min, sec].every(Number.isFinite)) return null;
  let dec = Math.abs(deg) + min / 60 + sec / 3600;
  const hemisphere = String(ref ?? "").toUpperCase();
  if (hemisphere === "S" || hemisphere === "W" || deg < 0) dec *= -1;
  return Number.isFinite(dec) ? dec : null;
}

function validCoord(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function coordsFromParsed(data: Record<string, unknown> | undefined): {
  latitude: number | null;
  longitude: number | null;
} {
  if (!data) return { latitude: null, longitude: null };
  const latitude =
    asFinite(data.latitude) ?? dmsToDecimal(data.GPSLatitude, data.GPSLatitudeRef);
  const longitude =
    asFinite(data.longitude) ??
    dmsToDecimal(data.GPSLongitude, data.GPSLongitudeRef);
  if (!validCoord(latitude, longitude)) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

function takenFromParsed(data: Record<string, unknown> | undefined) {
  const raw = data?.DateTimeOriginal ?? data?.CreateDate ?? data?.ModifyDate ?? null;
  const takenAt =
    raw instanceof Date
      ? raw.toISOString()
      : typeof raw === "string"
        ? new Date(raw).toISOString()
        : null;
  return takenAt && !Number.isNaN(Date.parse(takenAt)) ? takenAt : null;
}

export async function readPhotoExif(file: File): Promise<PhotoExif> {
  const empty: PhotoExif = { takenAt: null, latitude: null, longitude: null };
  try {
    const data = (await exifr.parse(file, {
      gps: true,
      exif: true,
      xmp: true,
      mergeOutput: true,
      reviveValues: true,
      pick: [
        "DateTimeOriginal",
        "CreateDate",
        "ModifyDate",
        "latitude",
        "longitude",
        "GPSLatitude",
        "GPSLongitude",
        "GPSLatitudeRef",
        "GPSLongitudeRef",
      ],
    })) as Record<string, unknown> | undefined;
    const fromParse = coordsFromParsed(data);
    if (fromParse.latitude != null) {
      return { takenAt: takenFromParsed(data), ...fromParse };
    }

    const gps = (await exifr.gps(file).catch(() => null)) as
      | { latitude?: unknown; longitude?: unknown }
      | null;
    const fromGps = coordsFromParsed(gps as Record<string, unknown> | undefined);
    return { takenAt: takenFromParsed(data), ...fromGps };
  } catch {
    return empty;
  }
}

async function compress(
  file: File,
  options: { maxWidthOrHeight: number; maxSizeMB: number; fileType?: string },
) {
  return imageCompression(file, {
    maxWidthOrHeight: options.maxWidthOrHeight,
    maxSizeMB: options.maxSizeMB,
    useWebWorker: true,
    initialQuality: 0.82,
    fileType: options.fileType ?? "image/jpeg",
  });
}

export async function prepareUploadFiles(file: File) {
  const full = await compress(file, {
    maxWidthOrHeight: 1920,
    maxSizeMB: 1.4,
  });
  const thumb = await compress(file, {
    maxWidthOrHeight: 1200,
    maxSizeMB: 0.55,
  });
  const bitmap = await createImageBitmap(full);
  return {
    full,
    thumb,
    width: bitmap.width,
    height: bitmap.height,
  };
}

export function guessLocationName(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

const COORD_LABEL = /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/;

/** Hide auto-filled "46.8837, 8.6356" labels; only show a real place name. */
export function humanLocationName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || COORD_LABEL.test(trimmed)) return null;
  return trimmed;
}

export function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
