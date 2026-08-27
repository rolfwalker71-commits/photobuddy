import { NextResponse } from "next/server";
import { HttpError, jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { addTagToPhoto, insertPhoto } from "@/lib/db/queries";
import { joinPhotoPath, savePhotoFile } from "@/lib/files";

const MAX_BYTES = 15 * 1024 * 1024;

function numOrNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  try {
    const user = await requireTeilnehmer();
    const form = await request.formData();
    const full = form.get("file");
    const thumb = form.get("thumb");
    if (!(full instanceof File) || !(thumb instanceof File)) {
      throw new HttpError(400, "Bilddatei fehlt.");
    }
    if (full.size > MAX_BYTES) {
      throw new HttpError(400, "Datei ist größer als 15 MB.");
    }

    const id = crypto.randomUUID();
    const storagePath = joinPhotoPath(user.id, `${id}.jpg`);
    const thumbnailPath = joinPhotoPath(user.id, "thumbs", `${id}.jpg`);
    await savePhotoFile(storagePath, Buffer.from(await full.arrayBuffer()));
    await savePhotoFile(thumbnailPath, Buffer.from(await thumb.arrayBuffer()));

    const takenRaw = String(form.get("takenAt") ?? "");
    const takenAt = takenRaw ? new Date(takenRaw).toISOString() : null;

    const photo = await insertPhoto({
      uploadedBy: user.id,
      storagePath,
      thumbnailPath,
      title: String(form.get("title") ?? "").trim() || null,
      description: String(form.get("description") ?? "").trim() || null,
      takenAt,
      latitude: numOrNull(form.get("latitude")),
      longitude: numOrNull(form.get("longitude")),
      locationName: String(form.get("locationName") ?? "").trim() || null,
      width: numOrNull(form.get("width")),
      height: numOrNull(form.get("height")),
      mimeType: "image/jpeg",
      fileSize: full.size,
    });

    const tags = String(form.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const name of tags) {
      await addTagToPhoto(photo.id, name);
    }

    return NextResponse.json({ photo });
  } catch (err) {
    return jsonError(err);
  }
}
