import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireTeilnehmer,
} from "@/lib/auth/request";
import {
  addTagToPhoto,
  findDuplicateInAlbum,
  findPhotoByClientUploadId,
  insertPhoto,
  updatePhotoWeather,
} from "@/lib/db/queries";
import { joinPhotoPath, removePhotoFiles, savePhotoFile } from "@/lib/files";
import { mediaContentHash } from "@/lib/hash";
import { extFromMime, isVideoMime } from "@/lib/mime";
import { notifyNewPhoto } from "@/lib/push";
import { fetchArchiveWeather } from "@/lib/weather";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_VIDEO_MS = 15_500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function numOrNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await requireTeilnehmer();
    const form = await request.formData();
    const albumId = String(form.get("albumId") ?? "").trim();
    if (!albumId) throw new HttpError(400, "Album fehlt.");
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      albumId,
      { upload: true },
    );
    const rawClientId = String(form.get("clientUploadId") ?? "").trim();
    const clientUploadId = UUID.test(rawClientId) ? rawClientId : null;
    if (clientUploadId) {
      // The upload queue retries after lost responses; answer with the first result.
      const existing = await findPhotoByClientUploadId(user.id, clientUploadId);
      if (existing) {
        return NextResponse.json({ photo: existing, duplicate: null, replayed: true });
      }
    }
    const full = form.get("file");
    const thumb = form.get("thumb");
    if (!(full instanceof File)) {
      throw new HttpError(400, "Datei fehlt.");
    }

    const mime = (full.type || "application/octet-stream").split(";")[0].trim();
    const isVideo = isVideoMime(mime) || String(form.get("kind") ?? "") === "video";
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (full.size > maxBytes) {
      throw new HttpError(
        400,
        isVideo
          ? "Video ist grösser als 40 MB."
          : "Datei ist grösser als 15 MB.",
      );
    }
    if (!isVideo && !(thumb instanceof File)) {
      throw new HttpError(400, "Bilddatei fehlt.");
    }

    const durationMs = numOrNull(form.get("durationMs"));
    if (isVideo && (durationMs == null || durationMs > MAX_VIDEO_MS)) {
      throw new HttpError(400, "Video darf höchstens 15 Sekunden lang sein.");
    }

    const width = numOrNull(form.get("width"));
    const height = numOrNull(form.get("height"));
    const bytes = Buffer.from(await full.arrayBuffer());
    const contentHash = mediaContentHash(bytes, width, height);
    const keepDuplicate = String(form.get("keepDuplicate") ?? "") === "1";
    const duplicate = await findDuplicateInAlbum(albumId, contentHash);
    if (duplicate && !keepDuplicate) {
      return NextResponse.json(
        {
          error: `Ähnliches Foto schon von ${duplicate.author_name}`,
          duplicate,
        },
        { status: 409 },
      );
    }

    const id = crypto.randomUUID();
    const ext = isVideo ? extFromMime(mime, "mp4") : "jpg";
    const storagePath = joinPhotoPath(user.id, `${id}.${ext}`);
    const thumbnailPath =
      thumb instanceof File
        ? joinPhotoPath(user.id, "thumbs", `${id}.jpg`)
        : null;
    await savePhotoFile(storagePath, bytes);
    if (thumb instanceof File && thumbnailPath) {
      await savePhotoFile(thumbnailPath, Buffer.from(await thumb.arrayBuffer()));
    }

    const takenRaw = String(form.get("takenAt") ?? "");
    const takenAt = takenRaw ? new Date(takenRaw).toISOString() : null;
    const latitude = numOrNull(form.get("latitude"));
    const longitude = numOrNull(form.get("longitude"));

    let weatherTempC: number | null = null;
    let weatherCode: number | null = null;
    if (latitude != null && longitude != null && takenAt) {
      const weather = await fetchArchiveWeather({
        latitude,
        longitude,
        takenAt,
      });
      if (weather) {
        weatherTempC = weather.tempC;
        weatherCode = weather.code;
      }
    }

    const insert = insertPhoto({
      albumId,
      uploadedBy: user.id,
      storagePath,
      thumbnailPath,
      title: String(form.get("title") ?? "").trim() || null,
      description: String(form.get("description") ?? "").trim() || null,
      takenAt,
      latitude,
      longitude,
      locationName: String(form.get("locationName") ?? "").trim() || null,
      width,
      height,
      mimeType: isVideo ? mime || "video/mp4" : "image/jpeg",
      fileSize: full.size,
      kind: isVideo ? "video" : "photo",
      durationMs: isVideo ? durationMs : null,
      weatherTempC,
      weatherCode,
      contentHash,
      clientUploadId,
    });
    let photo;
    try {
      photo = await insert;
    } catch (err) {
      // Two retries of the same queue item raced; keep the one that won.
      if ((err as { code?: string }).code === "23505" && clientUploadId) {
        await removePhotoFiles([storagePath, thumbnailPath]);
        const existing = await findPhotoByClientUploadId(user.id, clientUploadId);
        if (existing) {
          return NextResponse.json({ photo: existing, duplicate: null, replayed: true });
        }
      }
      throw err;
    }

    if (photo.weather_code == null && weatherCode != null) {
      await updatePhotoWeather(photo.id, {
        tempC: weatherTempC ?? 0,
        code: weatherCode,
      });
    }

    const tags = String(form.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const name of tags) {
      await addTagToPhoto(photo.id, name);
    }

    void notifyNewPhoto({
      photoId: photo.id,
      albumId: photo.album_id,
      uploaderId: user.id,
      uploaderName: user.display_name,
    });

    return NextResponse.json({
      photo,
      duplicate: duplicate && keepDuplicate ? duplicate : null,
    });
  } catch (err) {
    return jsonError(err);
  }
}
