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
import { getAlbum, listPhotos, listProfiles } from "@/lib/db/queries";
import { resolvePhotoPath } from "@/lib/files";
import { extFromMime } from "@/lib/mime";
import type { Photo } from "@/lib/types";
import {
  contentDispositionAttachment,
  filterPhotosForZip,
  parseUploaderIds,
  parseZipDateBound,
  zipDownloadFilename,
  zipEntryPath,
  zipFoldersByUploader,
  zipPhotoFilename,
  type ZipDownloadFilters,
} from "@/lib/zip-download";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function filtersFromSearch(url: URL): ZipDownloadFilters {
  const repeated = url.searchParams.getAll("uploaderIds");
  const ids = parseUploaderIds(
    repeated.length > 1 ? repeated : url.searchParams.get("uploaderIds"),
  );
  return boundsOrThrow({
    uploaderIds: ids,
    from: parseOptionalDate(url.searchParams.get("from")),
    to: parseOptionalDate(url.searchParams.get("to")),
  });
}

function filtersFromBody(body: Record<string, unknown>): ZipDownloadFilters {
  return boundsOrThrow({
    uploaderIds: parseUploaderIds(body.uploaderIds ?? body.uploader_ids),
    from: parseOptionalDate(body.from),
    to: parseOptionalDate(body.to),
  });
}

function parseOptionalDate(value: unknown): string {
  if (value == null || value === "") return "";
  const iso = parseZipDateBound(value);
  if (!iso) throw new HttpError(400, "Ungültiges Datum.");
  return iso;
}

function boundsOrThrow(filters: ZipDownloadFilters): ZipDownloadFilters {
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new HttpError(400, "Das Von-Datum liegt nach dem Bis-Datum.");
  }
  return filters;
}

async function photosForZip(
  albumId: string,
  filters: ZipDownloadFilters,
): Promise<Photo[]> {
  const photos = await listPhotos(albumId);
  return filterPhotosForZip(photos, filters);
}

async function buildZip(photos: Photo[]) {
  const profiles = await listProfiles();
  const folders = zipFoldersByUploader(photos, profiles);
  const zip = new yazl.ZipFile();
  const indexByFolder = new Map<string, number>();
  let added = 0;

  const sorted = [...photos].sort((a, b) => {
    const folderA = folders.get(a.uploaded_by) ?? "Unbekannt";
    const folderB = folders.get(b.uploaded_by) ?? "Unbekannt";
    const byFolder = folderA.localeCompare(folderB, "de");
    if (byFolder !== 0) return byFolder;
    return (a.taken_at ?? a.created_at).localeCompare(
      b.taken_at ?? b.created_at,
    );
  });

  for (const photo of sorted) {
    const absolute = resolvePhotoPath(photo.storage_path);
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) continue;
    const folder = folders.get(photo.uploaded_by) ?? "Unbekannt";
    const index = indexByFolder.get(folder) ?? 0;
    indexByFolder.set(folder, index + 1);
    zip.addReadStream(
      createReadStream(absolute),
      zipEntryPath(
        folder,
        zipPhotoFilename(
          photo.title?.trim() || photo.id.slice(0, 8),
          index,
          extFromMime(photo.mime_type, photo.kind === "video" ? "mp4" : "jpg"),
        ),
      ),
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

async function zipResponse(albumId: string, filters: ZipDownloadFilters) {
  const viewerAlbum = await getAlbum(albumId);
  if (!viewerAlbum) throw new HttpError(404, "Album nicht gefunden.");
  const photos = await photosForZip(albumId, filters);
  const stream = await buildZip(photos);
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDispositionAttachment(
        zipDownloadFilename(viewerAlbum.name),
      ),
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    return await zipResponse(id, filtersFromSearch(new URL(request.url)));
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return await zipResponse(id, filtersFromBody(body));
  } catch (err) {
    return jsonError(err);
  }
}
