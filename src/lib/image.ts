import imageCompression from "browser-image-compression";
import exifr from "exifr";

export type PhotoExif = {
  takenAt: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function readPhotoExif(file: File): Promise<PhotoExif> {
  try {
    const data = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"],
    });
    const rawDate = data?.DateTimeOriginal ?? data?.CreateDate ?? null;
    const takenAt =
      rawDate instanceof Date
        ? rawDate.toISOString()
        : typeof rawDate === "string"
          ? new Date(rawDate).toISOString()
          : null;
    return {
      takenAt: takenAt && !Number.isNaN(Date.parse(takenAt)) ? takenAt : null,
      latitude: typeof data?.latitude === "number" ? data.latitude : null,
      longitude: typeof data?.longitude === "number" ? data.longitude : null,
    };
  } catch {
    return { takenAt: null, latitude: null, longitude: null };
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
    maxWidthOrHeight: 480,
    maxSizeMB: 0.18,
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
