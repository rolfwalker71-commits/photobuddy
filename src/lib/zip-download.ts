import { formatAppDate, toIsoDate } from "@/lib/format-date";
import type { Photo, Profile } from "@/lib/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ZipDownloadFilters = {
  /** Empty = all uploaders. */
  uploaderIds: string[];
  /** `yyyy-mm-dd`, empty = open start. */
  from: string;
  /** `yyyy-mm-dd`, empty = open end. */
  to: string;
};

export type ZipPerson = {
  id: string;
  name: string;
};

export function parseUploaderIds(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,]+/)
      : [];
  return [
    ...new Set(
      raw
        .map((item) => String(item).trim())
        .filter((id) => UUID_RE.test(id)),
    ),
  ];
}

export function parseZipDateBound(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  return toIsoDate(value.trim());
}

export function photoStampDay(photo: Photo) {
  return (photo.taken_at ?? photo.created_at).slice(0, 10);
}

export function filterPhotosForZip(
  photos: Photo[],
  filters: ZipDownloadFilters,
) {
  return photos.filter((photo) => {
    if (
      filters.uploaderIds.length > 0 &&
      !filters.uploaderIds.includes(photo.uploaded_by)
    ) {
      return false;
    }
    const day = photoStampDay(photo);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return true;
  });
}

export function zipPeople(
  photos: Photo[],
  profiles: Profile[],
  memberIds: string[] = [],
): ZipPerson[] {
  const names = new Map(
    profiles.map((profile) => [profile.id, profile.display_name.trim()]),
  );
  const ids = new Set<string>([
    ...memberIds.filter(Boolean),
    ...photos.map((photo) => photo.uploaded_by).filter(Boolean),
  ]);
  return [...ids]
    .map((id) => ({
      id,
      name: names.get(id) || "Unbekannt",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function zipFolderName(displayName: string) {
  const cleaned = displayName
    .replace(/[/\\]+/g, "-")
    .replace(/[<>:"|?*\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/g, "")
    .slice(0, 80);
  return cleaned || "Unbekannt";
}

export function zipPhotoFilename(name: string, index: number) {
  const cleaned =
    name.replace(/[^\w\u00C0-\u024f .-]+/g, "_").slice(0, 60) || "foto";
  return `${String(index + 1).padStart(2, "0")}-${cleaned}.jpg`;
}

export function zipEntryPath(folder: string, filename: string) {
  return `Fotos/${folder}/${filename}`;
}

export function zipFoldersByUploader(
  photos: Photo[],
  profiles: Profile[],
) {
  const names = new Map(
    profiles.map((profile) => [profile.id, profile.display_name.trim()]),
  );
  const claimed = new Map<string, string>();
  const folderById = new Map<string, string>();

  for (const photo of photos) {
    const id = photo.uploaded_by || "";
    if (!id || folderById.has(id)) continue;
    const raw = names.get(id) || "Unbekannt";
    let folder = zipFolderName(raw);
    const taken = claimed.get(folder);
    if (taken && taken !== id) {
      folder = zipFolderName(`${raw}-${id.slice(0, 4)}`);
    }
    claimed.set(folder, id);
    folderById.set(id, folder);
  }

  return folderById;
}

export function zipDownloadFilename(albumName: string, when = new Date()) {
  const base =
    zipFolderName(albumName).replace(/\.zip$/i, "") || "photobuddy-download";
  return `${base}-${formatAppDate(when)}.zip`;
}

export function contentDispositionAttachment(filename: string) {
  const ascii =
    filename
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]+/g, "_")
      .replace(/["\\]/g, "_")
      .trim() || "photobuddy-download.zip";
  const encoded = encodeURIComponent(filename).replace(/['()]/g, (ch) =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function filenameFromDisposition(
  header: string | null | undefined,
  fallback: string,
) {
  if (!header) return fallback;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* keep looking */
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}
