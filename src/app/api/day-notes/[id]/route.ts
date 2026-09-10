import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import { deleteDayNote, getDayNote, upsertDayNote } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const note = await getDayNote(id);
    if (!note) throw new HttpError(404, "Notiz nicht gefunden.");
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, note.album_id);
    if (viewer.mode === "guest" || !viewer.user) {
      throw new HttpError(403, "Gäste dürfen Notizen nicht ändern.");
    }
    if (note.author_id !== viewer.user.id && viewer.user.role !== "admin") {
      throw new HttpError(403, "Diese Notiz gehört jemand anderem.");
    }
    const body = (await request.json()) as { body?: string };
    const text = body.body?.trim() ?? "";
    if (!text) throw new HttpError(400, "Notiz fehlt.");
    const result = await upsertDayNote({
      albumId: note.album_id,
      noteDate: note.note_date,
      body: text.slice(0, 500),
      authorId: viewer.user.id,
      isAdmin: viewer.user.role === "admin",
    });
    return NextResponse.json({ note: result.note });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const note = await getDayNote(id);
    if (!note) throw new HttpError(404, "Notiz nicht gefunden.");
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, note.album_id);
    if (viewer.mode === "guest" || !viewer.user) {
      throw new HttpError(403, "Gäste dürfen Notizen nicht löschen.");
    }
    if (note.author_id !== viewer.user.id && viewer.user.role !== "admin") {
      throw new HttpError(403, "Diese Notiz gehört jemand anderem.");
    }
    await deleteDayNote(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
