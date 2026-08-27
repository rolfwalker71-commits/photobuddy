import { NextResponse } from "next/server";
import { jsonError, requireViewer } from "@/lib/auth/request";
import {
  getPhotosUpdatedStamp,
  getShareLabel,
  listPhotos,
  listProfiles,
  listTags,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer(request);
    const [photos, profiles, tags, stamp] = await Promise.all([
      listPhotos(),
      listProfiles(),
      listTags(),
      getPhotosUpdatedStamp(),
    ]);
    const shareLabel =
      viewer.mode === "guest" && viewer.shareKey
        ? await getShareLabel(viewer.shareKey)
        : null;
    return NextResponse.json(
      {
        photos,
        profiles,
        tags,
        shareLabel,
        stamp,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
