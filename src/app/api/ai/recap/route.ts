import { NextResponse } from "next/server";
import { writeRecap } from "@/lib/ai";
import { requireAiUser, wrapAiError } from "@/lib/ai-guard";
import { HttpError, assertCanAccessAlbum, jsonError } from "@/lib/auth/request";
import { getAlbum, listDayNotes, listPhotos, listProfiles } from "@/lib/db/queries";
import { buildRecapStats } from "@/lib/recap";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireAiUser();
    const body = (await request.json().catch(() => ({}))) as { albumId?: string };
    const albumId = body.albumId?.trim() ?? "";
    if (!albumId) throw new HttpError(400, "albumId fehlt.");
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      albumId,
    );
    const [album, photos, profiles, notes] = await Promise.all([
      getAlbum(albumId),
      listPhotos(albumId),
      listProfiles(),
      listDayNotes(albumId),
    ]);
    if (!album) throw new HttpError(404, "Album nicht gefunden.");
    if (photos.length === 0) {
      throw new HttpError(422, "In diesem Album gibt es noch keine Fotos.");
    }
    try {
      const text = await writeRecap({
        albumName: album.name,
        stats: buildRecapStats(photos, profiles),
        notes,
      });
      return NextResponse.json({ text });
    } catch (err) {
      throw wrapAiError(err);
    }
  } catch (err) {
    return jsonError(err);
  }
}
