import { NextResponse } from "next/server";
import { HttpError, jsonError, requireTeilnehmer, requireViewer } from "@/lib/auth/request";
import {
  deletePhoto,
  getPhoto,
  listProfiles,
  listTagsForPhoto,
  updatePhoto,
} from "@/lib/db/queries";
import { removePhotoFiles } from "@/lib/files";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requireViewer(request);
    const { id } = await ctx.params;
    const photo = await getPhoto(id);
    if (!photo) throw new HttpError(404, "Foto nicht gefunden.");
    const [profiles, tags] = await Promise.all([
      listProfiles(),
      listTagsForPhoto(id),
    ]);
    const profile = profiles.find((p) => p.id === photo.uploaded_by) ?? null;
    return NextResponse.json({ photo, profile, tags });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requireTeilnehmer();
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      location_name?: string;
    };
    const photo = await updatePhoto(id, {
      title: body.title?.trim() || null,
      description: body.description?.trim() || null,
      locationName: body.location_name?.trim() || null,
    });
    if (!photo) throw new HttpError(404, "Foto nicht gefunden.");
    return NextResponse.json({ photo });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    await requireTeilnehmer();
    const { id } = await ctx.params;
    const photo = await getPhoto(id);
    if (!photo) throw new HttpError(404, "Foto nicht gefunden.");
    await deletePhoto(id);
    await removePhotoFiles([photo.storage_path, photo.thumbnail_path]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
