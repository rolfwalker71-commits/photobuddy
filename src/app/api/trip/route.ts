import { NextResponse } from "next/server";
import { jsonError, requireViewer } from "@/lib/auth/request";
import { getShareLabel, listPhotos, listProfiles, listTags } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer(request);
    const [photos, profiles, tags] = await Promise.all([
      listPhotos(),
      listProfiles(),
      listTags(),
    ]);
    const shareLabel =
      viewer.mode === "guest" && viewer.shareKey
        ? await getShareLabel(viewer.shareKey)
        : null;
    return NextResponse.json({
      photos,
      profiles,
      tags,
      shareLabel,
    });
  } catch (err) {
    return jsonError(err);
  }
}
