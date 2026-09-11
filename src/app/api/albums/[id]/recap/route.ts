import { NextResponse } from "next/server";
import {
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import { getAlbum, listPhotos, listProfiles } from "@/lib/db/queries";
import { buildRecapStats } from "@/lib/recap";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    const [album, photos, profiles] = await Promise.all([
      getAlbum(id),
      listPhotos(id),
      listProfiles(),
    ]);
    return NextResponse.json(
      {
        album,
        stats: buildRecapStats(photos, profiles),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
