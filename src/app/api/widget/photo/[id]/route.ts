import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getSessionUserRow, HttpError, jsonError } from "@/lib/auth/request";
import { getPhoto, isAlbumMember } from "@/lib/db/queries";
import { resolvePhotoPath } from "@/lib/files";
import { mimeFromPath } from "@/lib/mime";
import { requireWidgetUser } from "@/lib/widget/auth";

type Ctx = { params: Promise<{ id: string }> };

/**
 * A widget token, or an ordinary session. The settings page previews the
 * widgets with the very same image URLs the script will use, and in the
 * browser there is a cookie rather than a token.
 */
async function resolveUser(request: Request) {
  const session = await getSessionUserRow();
  if (session) return session;
  return requireWidgetUser(request);
}

/**
 * One photo for the widget, by id rather than by path: the token carries no
 * album of its own, so membership is checked per photo here. A video has no
 * frame to show beyond its thumbnail, so `full` falls back to the thumbnail.
 */
export async function GET(request: Request, ctx: Ctx) {
  try {
    const user = await resolveUser(request);
    const { id } = await ctx.params;
    const photo = await getPhoto(id);
    if (!photo || photo.deleted_at) throw new HttpError(404, "Foto nicht gefunden.");

    if (user.role !== "admin" && !(await isAlbumMember(photo.album_id, user.id))) {
      throw new HttpError(403, "Kein Zugriff auf dieses Album.");
    }

    const size = new URL(request.url).searchParams.get("size");
    const wantsThumb = size !== "full" || photo.kind === "video";
    const relative =
      (wantsThumb ? photo.thumbnail_path : photo.storage_path) ||
      photo.thumbnail_path ||
      photo.storage_path;

    const absolute = resolvePhotoPath(relative);
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) throw new HttpError(404, "Datei nicht gefunden.");

    const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": mimeFromPath(relative, "application/octet-stream"),
        "Content-Length": String(info.size),
        // Scriptable caches images on disk itself; this only helps a refresh
        // that happens while the same photo is still the newest one.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
