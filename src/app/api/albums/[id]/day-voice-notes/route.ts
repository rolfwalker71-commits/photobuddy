import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import {
  listDayVoiceNotes,
  upsertDayVoiceNote,
} from "@/lib/db/queries";
import { joinPhotoPath, removePhotoFiles, savePhotoFile } from "@/lib/files";
import { extFromMime, isAudioMime } from "@/lib/mime";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_MS = 20_000;

function numOrNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const viewer = await requireViewer(request);
    await assertCanAccessAlbum(viewer, id);
    return NextResponse.json({ notes: await listDayVoiceNotes(id) });
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
      throw new HttpError(403, "Gäste dürfen keine Sprachnotizen aufnehmen.");
    }
    const form = await request.formData();
    const noteDate = String(form.get("note_date") ?? form.get("noteDate") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) {
      throw new HttpError(400, "Datum fehlt.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Audiodatei fehlt.");
    if (file.size > MAX_BYTES) {
      throw new HttpError(400, "Sprachnotiz ist grösser als 3 MB.");
    }
    const mime = (file.type || "audio/webm").split(";")[0].trim();
    if (!isAudioMime(mime) && mime !== "video/webm") {
      throw new HttpError(400, "Ungültiges Audioformat.");
    }
    const durationMs = numOrNull(form.get("duration_ms") ?? form.get("durationMs"));
    if (durationMs == null || durationMs <= 0 || durationMs > MAX_MS) {
      throw new HttpError(400, "Sprachnotiz darf höchstens 20 Sekunden lang sein.");
    }

    const ext = extFromMime(mime === "video/webm" ? "audio/webm" : mime, "webm");
    const storagePath = joinPhotoPath("voice", id, `${noteDate}-${crypto.randomUUID()}.${ext}`);
    await savePhotoFile(storagePath, Buffer.from(await file.arrayBuffer()));

    const result = await upsertDayVoiceNote({
      albumId: id,
      noteDate,
      authorId: viewer.user.id,
      storagePath,
      durationMs: Math.min(Math.round(durationMs), MAX_MS),
      mimeType: mime.startsWith("audio/") ? mime : "audio/webm",
    });
    if (result.previousPath && result.previousPath !== storagePath) {
      await removePhotoFiles([result.previousPath]);
    }
    return NextResponse.json({
      note: result.note,
      notes: await listDayVoiceNotes(id),
    });
  } catch (err) {
    return jsonError(err);
  }
}
