import { NextResponse } from "next/server";
import { HttpError, jsonError, requirePhotoAccess } from "@/lib/auth/request";
import { deleteComment, getComment } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const comment = await getComment(id);
    if (!comment) throw new HttpError(404, "Kommentar nicht gefunden.");

    const { viewer } = await requirePhotoAccess(request, comment.photo_id);
    const body = (await request.json().catch(() => ({}))) as {
      guest_session_id?: string;
    };

    if (viewer.mode === "teilnehmer" && viewer.user) {
      const isAdmin = viewer.user.role === "admin";
      const isAuthor = comment.author_id === viewer.user.id;
      if (!isAdmin && !isAuthor) {
        throw new HttpError(403, "Du darfst diesen Kommentar nicht löschen.");
      }
    } else if (viewer.mode === "guest") {
      const sessionId = body.guest_session_id?.trim() ?? "";
      if (
        !comment.guest_session_id ||
        !sessionId ||
        comment.guest_session_id !== sessionId
      ) {
        throw new HttpError(403, "Du darfst diesen Kommentar nicht löschen.");
      }
    } else {
      throw new HttpError(403, "Nicht berechtigt.");
    }

    await deleteComment(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
