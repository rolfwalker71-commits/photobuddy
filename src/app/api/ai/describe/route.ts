import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { NextResponse } from "next/server";
import { describePhotoImage } from "@/lib/ai";
import { requireAiUser, wrapAiError } from "@/lib/ai-guard";
import { HttpError, assertCanAccessAlbum, jsonError } from "@/lib/auth/request";
import { getPhoto } from "@/lib/db/queries";
import { resolvePhotoPath } from "@/lib/files";

export const dynamic = "force-dynamic";

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const MAX_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireAiUser();
    const body = (await request.json().catch(() => ({}))) as {
      photoId?: string;
      language?: string;
    };
    const photoId = body.photoId?.trim() ?? "";
    if (!photoId) throw new HttpError(400, "photoId fehlt.");
    const photo = await getPhoto(photoId);
    if (!photo) throw new HttpError(404, "Foto nicht gefunden.");
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      photo.album_id,
    );

    // Prefer the small thumbnail; fall back to the original when it is an image.
    let data: Buffer | null = null;
    let mime = "";
    for (const rel of [photo.thumbnail_path, photo.storage_path]) {
      const type = rel ? IMAGE_MIME[extname(rel).toLowerCase()] : undefined;
      if (!rel || !type) continue;
      try {
        const buf = await readFile(resolvePhotoPath(rel));
        if (buf.length > MAX_BYTES) continue;
        data = buf;
        mime = type;
        break;
      } catch {
        /* try next */
      }
    }
    if (!data) throw new HttpError(422, "Für dieses Foto gibt es kein Bild zum Beschreiben.");

    const language = /^[a-z]{2}(-[A-Za-z]{2})?$/.test(body.language ?? "")
      ? body.language
      : "de";
    try {
      const result = await describePhotoImage({
        base64: data.toString("base64"),
        mime,
        language,
      });
      return NextResponse.json(result);
    } catch (err) {
      throw wrapAiError(err);
    }
  } catch (err) {
    return jsonError(err);
  }
}
