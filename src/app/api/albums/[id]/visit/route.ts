import { NextResponse } from "next/server";
import {
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import { getAlbumVisit, touchAlbumVisit } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

function isoOrNull(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    const url = new URL(request.url);
    const guestSessionId = url.searchParams.get("guestSessionId");
    const visit = await getAlbumVisit({
      albumId: id,
      userId: viewer.mode === "teilnehmer" ? viewer.user.id : null,
      guestSessionId: viewer.mode === "guest" ? guestSessionId : null,
    });
    return NextResponse.json({
      last_seen_at: isoOrNull(visit?.last_seen_at),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    const body = (await request.json().catch(() => ({}))) as {
      guest_session_id?: string;
    };
    const previous = await getAlbumVisit({
      albumId: id,
      userId: viewer.mode === "teilnehmer" ? viewer.user.id : null,
      guestSessionId:
        viewer.mode === "guest" ? body.guest_session_id ?? null : null,
    });
    const now = await touchAlbumVisit({
      albumId: id,
      userId: viewer.mode === "teilnehmer" ? viewer.user.id : null,
      guestSessionId:
        viewer.mode === "guest" ? body.guest_session_id ?? null : null,
    });
    return NextResponse.json({
      previous_last_seen_at: isoOrNull(previous?.last_seen_at),
      last_seen_at: isoOrNull(now),
    });
  } catch (err) {
    return jsonError(err);
  }
}
