import { NextResponse } from "next/server";
import { searchPhotos } from "@/lib/ai";
import { requireAiUser, wrapAiError } from "@/lib/ai-guard";
import { HttpError, assertCanAccessAlbum, jsonError } from "@/lib/auth/request";
import { listPhotosForGrid, listProfiles } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireAiUser();
    const body = (await request.json().catch(() => ({}))) as {
      albumId?: string;
      query?: string;
    };
    const albumId = body.albumId?.trim() ?? "";
    const query = body.query?.trim().slice(0, 300) ?? "";
    if (!albumId) throw new HttpError(400, "albumId fehlt.");
    if (!query) throw new HttpError(400, "Suchanfrage fehlt.");
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      albumId,
    );
    const [photos, profiles] = await Promise.all([
      listPhotosForGrid(albumId),
      listProfiles(),
    ]);
    if (photos.length === 0) return NextResponse.json({ photoIds: [] });
    try {
      const photoIds = await searchPhotos({
        query,
        photos,
        uploaderNames: new Map(profiles.map((p) => [p.id, p.display_name])),
      });
      return NextResponse.json({ photoIds });
    } catch (err) {
      throw wrapAiError(err);
    }
  } catch (err) {
    return jsonError(err);
  }
}
