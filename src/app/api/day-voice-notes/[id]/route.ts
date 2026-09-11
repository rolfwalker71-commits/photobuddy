import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import { deleteDayVoiceNote, getDayVoiceNote } from "@/lib/db/queries";
import { removePhotoFiles } from "@/lib/files";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    if (viewer.mode === "guest" || !viewer.user) {
      throw new HttpError(403, "Gäste dürfen Sprachnotizen nicht löschen.");
    }
    const note = await getDayVoiceNote(id);
    if (!note) throw new HttpError(404, "Sprachnotiz nicht gefunden.");
    await assertCanAccessAlbum(viewer, note.album_id);
    if (note.author_id !== viewer.user.id && viewer.user.role !== "admin") {
      throw new HttpError(403, "Diese Sprachnotiz gehört jemand anderem.");
    }
    const path = await deleteDayVoiceNote(id);
    await removePhotoFiles([path]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
