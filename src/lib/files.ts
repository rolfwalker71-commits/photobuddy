import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export function photosDir() {
  return process.env.PHOTOS_DIR || "/data/photos";
}

export function resolvePhotoPath(relative: string) {
  const root = resolve(photosDir());
  const cleaned = relative.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("\0")) {
    throw new Error("Ungültiger Dateipfad.");
  }
  const absolute = resolve(root, cleaned);
  const rel = normalize(absolute).startsWith(root + sep) || normalize(absolute) === root;
  if (!rel) throw new Error("Ungültiger Dateipfad.");
  return absolute;
}

export async function savePhotoFile(relative: string, data: Buffer) {
  const absolute = resolvePhotoPath(relative);
  await mkdir(dirname(absolute), { recursive: true });
  await pipeline(Readable.from(data), createWriteStream(absolute));
}

export async function removePhotoFiles(paths: Array<string | null | undefined>) {
  await Promise.all(
    paths.filter(Boolean).map(async (rel) => {
      try {
        await unlink(resolvePhotoPath(rel as string));
      } catch {
        // already gone
      }
    }),
  );
}

export function joinPhotoPath(...parts: string[]) {
  return join(...parts).replaceAll("\\", "/");
}
