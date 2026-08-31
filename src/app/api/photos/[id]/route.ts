import { NextResponse } from "next/server";
import { HttpError, jsonError, requirePhotoAccess, requirePhotoEditor } from "@/lib/auth/request";
import {
  deletePhoto,
  listProfiles,
  listTagsForPhoto,
  updatePhoto,
} from "@/lib/db/queries";
import { removePhotoFiles } from "@/lib/files";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { photo } = await requirePhotoAccess(request, id);
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

async function updatePhotoMeta(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await requirePhotoEditor(request, id);
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

export const PATCH = updatePhotoMeta;
export const PUT = updatePhotoMeta;

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { photo } = await requirePhotoEditor(request, id);
    await deletePhoto(id);
    await removePhotoFiles([photo.storage_path, photo.thumbnail_path]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
