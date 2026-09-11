import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireEditor,
} from "@/lib/auth/request";
import {
  addTagToPhoto,
  listPhotosByIds,
  listTrashedPhotos,
  movePhotosToAlbum,
  purgePhotosByIds,
  restorePhotos,
  shiftPhotosTakenAt,
  softDeletePhotos,
  updatePhotosLocation,
} from "@/lib/db/queries";
import { removePhotoFiles } from "@/lib/files";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseIds(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  return [
    ...new Set(raw.map((item) => String(item).trim()).filter((id) => UUID_RE.test(id))),
  ];
}

export async function POST(request: Request) {
  try {
    const user = await requireEditor(request);
    const body = (await request.json()) as {
      action?: string;
      albumId?: string;
      photoIds?: unknown;
      tags?: unknown;
      location_name?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      targetAlbumId?: string;
      hours?: number;
    };
    const albumId = String(body.albumId ?? "").trim();
    if (!albumId) throw new HttpError(400, "Album fehlt.");
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      albumId,
    );

    const ids = parseIds(body.photoIds);
    if (ids.length === 0) throw new HttpError(400, "Keine Fotos ausgewählt.");

    const action = body.action ?? "";
    if (action === "restore" || action === "purge") {
      const trash = await listTrashedPhotos(albumId);
      const allowed = new Set(trash.map((photo) => photo.id));
      const scoped = ids.filter((id) => allowed.has(id));
      if (action === "restore") {
        const photos = await restorePhotos(scoped);
        return NextResponse.json({ photos, count: photos.length });
      }
      const removed = await purgePhotosByIds(scoped);
      await removePhotoFiles(
        removed.flatMap((row) => [row.storage_path, row.thumbnail_path]),
      );
      return NextResponse.json({ count: removed.length });
    }

    const owned = await listPhotosByIds(albumId, ids);
    if (owned.length === 0) throw new HttpError(404, "Keine Fotos gefunden.");
    const ownedIds = owned.map((photo) => photo.id);

    if (action === "delete") {
      const photos = await softDeletePhotos(ownedIds);
      return NextResponse.json({ photos, count: photos.length });
    }

    if (action === "tags") {
      const tags = Array.isArray(body.tags)
        ? body.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : String(body.tags ?? "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
      if (tags.length === 0) throw new HttpError(400, "Tag fehlt.");
      for (const photoId of ownedIds) {
        for (const name of tags) {
          await addTagToPhoto(photoId, name);
        }
      }
      return NextResponse.json({ count: ownedIds.length });
    }

    if (action === "location") {
      const lat =
        body.latitude === null || body.latitude === undefined
          ? body.latitude
          : Number(body.latitude);
      const lng =
        body.longitude === null || body.longitude === undefined
          ? body.longitude
          : Number(body.longitude);
      const photos = await updatePhotosLocation(ownedIds, {
        locationName: body.location_name?.trim() || null,
        latitude:
          lat !== undefined && (lat === null || Number.isFinite(lat))
            ? lat
            : undefined,
        longitude:
          lng !== undefined && (lng === null || Number.isFinite(lng))
            ? lng
            : undefined,
      });
      return NextResponse.json({ photos, count: photos.length });
    }

    if (action === "move") {
      const target = String(body.targetAlbumId ?? "").trim();
      if (!target) throw new HttpError(400, "Zielalbum fehlt.");
      await assertCanAccessAlbum(
        { mode: "teilnehmer", user, shareKey: null, albumId: null },
        target,
        { upload: true },
      );
      const photos = await movePhotosToAlbum(ownedIds, target);
      return NextResponse.json({ photos, count: photos.length });
    }

    if (action === "shift") {
      const hours = Number(body.hours);
      if (!Number.isInteger(hours) || hours < -24 || hours > 24 || hours === 0) {
        throw new HttpError(400, "Stunden müssen eine ganze Zahl von −24 bis 24 sein.");
      }
      const photos = await shiftPhotosTakenAt(ownedIds, hours);
      return NextResponse.json({ photos, count: photos.length });
    }

    throw new HttpError(400, "Unbekannte Aktion.");
  } catch (err) {
    return jsonError(err);
  }
}
