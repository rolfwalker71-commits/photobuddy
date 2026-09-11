import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { HttpError, jsonError, requirePhotoAccess } from "@/lib/auth/request";
import { resolvePhotoPath } from "@/lib/files";
import { extFromMime } from "@/lib/mime";

type Ctx = { params: Promise<{ id: string }> };

function safeFilename(name: string) {
  return name.replace(/[^\w\u00C0-\u024f .-]+/g, "_").slice(0, 80) || "foto";
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { photo } = await requirePhotoAccess(request, id);
    const absolute = resolvePhotoPath(photo.storage_path);
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) throw new HttpError(404, "Datei nicht gefunden.");

    const base = safeFilename(
      photo.title?.trim() ||
        `${photo.kind === "video" ? "video" : "foto"}-${photo.id.slice(0, 8)}`,
    );
    const ext = `.${extFromMime(photo.mime_type, photo.kind === "video" ? "mp4" : "jpg")}`;
    const filename = base.toLowerCase().endsWith(ext) ? base : `${base}${ext}`;
    const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;

    return new Response(stream, {
      headers: {
        "Content-Type": photo.mime_type || "image/jpeg",
        "Content-Length": String(info.size),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
