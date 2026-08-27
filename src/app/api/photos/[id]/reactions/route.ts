import { NextResponse } from "next/server";
import { HttpError, jsonError, requireViewer } from "@/lib/auth/request";
import {
  getPhoto,
  listReactions,
  toggleGuestReaction,
  toggleTeilnehmerReaction,
} from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requireViewer(request);
    const { id } = await ctx.params;
    return NextResponse.json({ reactions: await listReactions(id) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const viewer = await requireViewer(request);
    const { id } = await ctx.params;
    if (!(await getPhoto(id))) throw new HttpError(404, "Foto nicht gefunden.");
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
      const sessionId = body.guest_session_id?.trim() ?? "";
      if (!sessionId) throw new HttpError(400, "Gäste-Sitzung fehlt.");
      await toggleGuestReaction({
        photoId: id,
        guestName: body.guest_name?.trim() || "Gast",
        guestSessionId: sessionId,
        emoji,
      });
    }

    return NextResponse.json({ reactions: await listReactions(id) });
  } catch (err) {
    return jsonError(err);
  }
}
