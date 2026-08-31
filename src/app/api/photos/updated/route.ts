import { NextResponse } from "next/server";
import {
  albumIdFrom,
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import { getPhotosUpdatedStamp } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer(request);
    const albumId =
      viewer.mode === "guest" ? viewer.albumId : albumIdFrom(request);
    if (!albumId) {
      return NextResponse.json(
        { stamp: "empty" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    await assertCanAccessAlbum(viewer, albumId);
    const stamp = await getPhotosUpdatedStamp(albumId);
    return NextResponse.json(
      { stamp },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
