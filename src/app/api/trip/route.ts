import { NextResponse } from "next/server";
import {
  albumIdFrom,
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import {
  getAlbum,
  getPhotosUpdatedStamp,
  getShareLabel,
  listAlbums,
  listAlbumsForUser,
  listPhotosForGrid,
  listProfiles,
  listTags,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer(request);
    const albums =
      viewer.mode === "guest"
        ? [await getAlbum(viewer.albumId)]
        : viewer.user.role === "admin"
          ? await listAlbums()
          : await listAlbumsForUser(viewer.user.id);

    const visible = albums.filter((album): album is NonNullable<typeof album> => album != null);
    const requested =
      viewer.mode === "guest" ? viewer.albumId : albumIdFrom(request);
    const current =
      visible.find((album) => album!.id === requested) ?? visible[0] ?? null;

    if (current) {
      await assertCanAccessAlbum(viewer, current.id);
    }

    const [photos, profiles, tags, stamp] = current
      ? await Promise.all([
          listPhotosForGrid(current.id),
          listProfiles(),
          listTags(),
          getPhotosUpdatedStamp(current.id),
        ])
      : [[], [], [], "empty"];

    const shareLabel =
      viewer.mode === "guest" && viewer.shareKey
        ? await getShareLabel(viewer.shareKey)
        : current?.name ?? null;

    return NextResponse.json(
      {
        photos,
        profiles,
        tags,
        shareLabel,
        stamp,
        albums: visible,
        currentAlbum: current,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
