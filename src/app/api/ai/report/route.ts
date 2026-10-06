import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { NextResponse } from "next/server";
import {
  REPORT_MAX_PHOTOS,
  REPORT_VISION_PHOTOS,
  ReportInputError,
  parseReportExtras,
  reportPhotos,
  writeReport,
} from "@/lib/ai";
import { requireAiUser, wrapAiError } from "@/lib/ai-guard";
import { HttpError, assertCanAccessAlbum, jsonError } from "@/lib/auth/request";
import { listDayNotes, listPhotosByIds, updatePhotosLocation } from "@/lib/db/queries";
import { reverseGeocode } from "@/lib/geocode";
import { placesMap, resolveMissingPlaces } from "@/lib/photo-places";
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
      albumId?: unknown;
      photoIds?: unknown;
      title?: unknown;
      language?: unknown;
      context?: unknown;
      everyone?: unknown;
      people?: unknown;
      length?: unknown;
    };
    const albumId = typeof body.albumId === "string" ? body.albumId.trim() : "";
    if (!albumId) throw new HttpError(400, "albumId fehlt.");
    if (!Array.isArray(body.photoIds) || body.photoIds.length === 0) {
      throw new HttpError(400, "photoIds fehlt.");
    }
    const ids = [
      ...new Set(
        body.photoIds
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    if (ids.length === 0) throw new HttpError(400, "photoIds fehlt.");
    if (ids.length > REPORT_MAX_PHOTOS) {
      throw new HttpError(400, `Höchstens ${REPORT_MAX_PHOTOS} Fotos pro Bericht.`);
    }
    if (body.language !== undefined && body.language !== "de") {
      throw new HttpError(400, "Es wird nur Deutsch (language: \"de\") unterstützt.");
    }
    let extras: ReturnType<typeof parseReportExtras>;
    try {
      extras = parseReportExtras(body, ids);
    } catch (err) {
      if (err instanceof ReportInputError) throw new HttpError(400, err.message);
      throw err;
    }
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      albumId,
    );

    // Only photos of this album come back; videos are skipped.
    let photos = reportPhotos(await listPhotosByIds(albumId, ids));
    if (photos.length === 0) {
      throw new HttpError(422, "Keine verwendbaren Fotos ausgewählt.");
    }

    // Photos with GPS but no place name: look the place up and remember it.
    const resolved = await resolveMissingPlaces(
      photos,
      async (lat, lng) => (await reverseGeocode(lat, lng)).place,
    );
    if (resolved.size > 0) {
      const byName = new Map<string, string[]>();
      for (const [id, name] of resolved) byName.set(name, [...(byName.get(name) ?? []), id]);
      for (const [name, photoIds] of byName) {
        try {
          await updatePhotosLocation(photoIds, { locationName: name });
        } catch {
          /* still usable for this request */
        }
      }
      photos = photos.map((p) =>
        resolved.has(p.id) ? { ...p, location_name: resolved.get(p.id) ?? null } : p,
      );
    }

    const images = new Map<string, { base64: string; mime: string }>();
    for (const p of photos.slice(0, REPORT_VISION_PHOTOS)) {
      for (const rel of [p.thumbnail_path, p.storage_path]) {
        const mime = rel ? IMAGE_MIME[extname(rel).toLowerCase()] : undefined;
        if (!rel || !mime) continue;
        try {
          const buf = await readFile(resolvePhotoPath(rel));
          if (buf.length > MAX_BYTES) continue;
          images.set(p.id, { base64: buf.toString("base64"), mime });
          break;
        } catch {
          /* try next */
        }
      }
    }

    try {
      let dayNotes: Awaited<ReturnType<typeof listDayNotes>> = [];
      try {
        dayNotes = await listDayNotes(albumId);
      } catch {
        /* optional extra */
      }
      const draft = await writeReport({
        photos,
        images,
        title,
        length: extras.length,
        extras: {
          context: extras.context,
          everyone: extras.everyone,
          people: extras.people,
          dayNotes,
        },
      });
      return NextResponse.json({ ...draft, places: placesMap(photos) });
    } catch (err) {
      throw wrapAiError(err);
    }
  } catch (err) {
    return jsonError(err);
  }
}
