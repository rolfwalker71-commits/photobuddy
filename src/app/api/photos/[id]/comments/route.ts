import { NextResponse } from "next/server";
import { HttpError, jsonError, requirePhotoAccess } from "@/lib/auth/request";
import {
  addGuestComment,
  addTeilnehmerComment,
  listComments,
} from "@/lib/db/queries";
import { notifyNewComment } from "@/lib/push";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await requirePhotoAccess(request, id);
    return NextResponse.json({ comments: await listComments(id) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { viewer } = await requirePhotoAccess(request, id);
    const body = (await request.json()) as {
      body?: string;
      guest_name?: string;
      guest_session_id?: string;
    };
    const text = body.body?.trim() ?? "";
    if (!text) throw new HttpError(400, "Kommentar fehlt.");

    let commenterName = "";
    let commenterUserId: string | null = null;
    if (viewer.mode === "teilnehmer" && viewer.user) {
      await addTeilnehmerComment({
        photoId: id,
        authorId: viewer.user.id,
        body: text.slice(0, 2000),
      });
      commenterName = viewer.user.display_name;
      commenterUserId = viewer.user.id;
    } else {
      const name = body.guest_name?.trim() ?? "";
      const sessionId = body.guest_session_id?.trim() ?? "";
      if (name.length < 2) throw new HttpError(400, "Bitte einen Namen angeben.");
      if (!sessionId) throw new HttpError(400, "Gäste-Sitzung fehlt.");
      await addGuestComment({
        photoId: id,
        guestName: name,
        guestSessionId: sessionId,
        body: text,
      });
      commenterName = name;
    }

    if (commenterName) {
      void notifyNewComment({
        photoId: id,
        commenterName,
        commenterUserId,
      });
    }

    return NextResponse.json({ comments: await listComments(id) });
  } catch (err) {
    return jsonError(err);
  }
}
