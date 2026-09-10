import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import { listDayNotes, upsertDayNote } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    return NextResponse.json({ notes: await listDayNotes(id) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    if (viewer.mode === "guest" || !viewer.user) {
      throw new HttpError(403, "Gäste dürfen keine Tagesnotizen schreiben.");
    }
    const body = (await request.json()) as { note_date?: string; body?: string };
    const noteDate = body.note_date?.trim() ?? "";
    const text = body.body?.trim() ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) {
      throw new HttpError(400, "Datum fehlt.");
    }
    if (!text) throw new HttpError(400, "Notiz fehlt.");
    const result = await upsertDayNote({
      albumId: id,
      noteDate,
      body: text.slice(0, 500),
      authorId: viewer.user.id,
      isAdmin: viewer.user.role === "admin",
    });
    if (result.error === "forbidden") {
      throw new HttpError(403, "Diese Notiz gehört jemand anderem.");
    }
    return NextResponse.json({ note: result.note, notes: await listDayNotes(id) });
  } catch (err) {
    return jsonError(err);
  }
}
