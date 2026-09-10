import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import yazl from "yazl";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import {
  getAlbum,
  listHighlightPhotos,
  listPhotos,
  listPhotosByIds,
} from "@/lib/db/queries";
import { resolvePhotoPath } from "@/lib/files";
import type { Photo } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function safeFilename(name: string, index: number) {
  const cleaned =
    name.replace(/[^\w\u00C0-\u024f .-]+/g, "_").slice(0, 60) || "foto";
  return `${String(index + 1).padStart(2, "0")}-${cleaned}.jpg`;
}

async function photosForZip(
  albumId: string,
  requestedIds: string[] | undefined,
): Promise<Photo[]> {
  if (requestedIds && requestedIds.length > 0) {
    return listPhotosByIds(albumId, requestedIds);
  }
  const highlights = await listHighlightPhotos(albumId);
  if (highlights.length > 0) return highlights;
  return listPhotos(albumId);
}

async function buildZip(photos: Photo[]) {
  const zip = new yazl.ZipFile();
  let added = 0;
  for (const [index, photo] of photos.entries()) {
    const absolute = resolvePhotoPath(photo.storage_path);
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) continue;
    zip.addReadStream(
      createReadStream(absolute),
      safeFilename(photo.title?.trim() || photo.id.slice(0, 8), index),
    );
    added += 1;
  }
  if (added === 0) {
    throw new HttpError(404, "Keine Fotos zum Herunterladen.");
  }
  zip.end();
  return Readable.toWeb(
    zip.outputStream as unknown as Readable,
  ) as ReadableStream;
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    if (!(await getAlbum(id))) throw new HttpError(404, "Album nicht gefunden.");
    const photos = await photosForZip(id, undefined);
    const stream = await buildZip(photos);
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="Oma-Auswahl.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    if (!(await getAlbum(id))) throw new HttpError(404, "Album nicht gefunden.");
    const body = (await request.json().catch(() => ({}))) as {
      photo_ids?: string[];
    };
    const photos = await photosForZip(
      id,
      Array.isArray(body.photo_ids) ? body.photo_ids.filter(Boolean) : undefined,
    );
    const stream = await buildZip(photos);
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="Oma-Auswahl.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
