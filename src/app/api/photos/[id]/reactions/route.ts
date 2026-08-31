import { NextResponse } from "next/server";
import { HttpError, jsonError, requirePhotoAccess } from "@/lib/auth/request";
import {
  listReactions,
  toggleGuestReaction,
  toggleTeilnehmerReaction,
} from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await requirePhotoAccess(request, id);
    return NextResponse.json({ reactions: await listReactions(id) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { viewer } = await requirePhotoAccess(request, id);
    const body = (await request.json()) as {
      emoji?: string;
      guest_name?: string;
      guest_session_id?: string;
    };
    const emoji = body.emoji?.trim() ?? "";
    if (!emoji) throw new HttpError(400, "Emoji fehlt.");

    if (viewer.mode === "teilnehmer" && viewer.user) {
      await toggleTeilnehmerReaction({
        photoId: id,
        authorId: viewer.user.id,
        emoji,
      });
    } else {
      const name = body.guest_name?.trim() ?? "";
      const sessionId = body.guest_session_id?.trim() ?? "";
      if (name.length < 2) throw new HttpError(400, "Bitte einen Namen angeben.");
      if (!sessionId) throw new HttpError(400, "Gäste-Sitzung fehlt.");
      await toggleGuestReaction({
        photoId: id,
        guestName: name,
        guestSessionId: sessionId,
        emoji,
      });
    }

    return NextResponse.json({ reactions: await listReactions(id) });
  } catch (err) {
    return jsonError(err);
  }
}
