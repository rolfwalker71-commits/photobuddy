import { NextResponse } from "next/server";
import {
  albumIdFrom,
  assertCanAccessAlbum,
  jsonError,
  requireEditor,
} from "@/lib/auth/request";
import { listTrashedPhotos } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEditor(request);
    const albumId = albumIdFrom(request);
    if (!albumId) {
      return NextResponse.json({ photos: [] });
    }
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      albumId,
    );
    return NextResponse.json(
      { photos: await listTrashedPhotos(albumId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
