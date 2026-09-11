import { NextResponse } from "next/server";
import { HttpError, jsonError, requirePhotoAccess, requirePhotoEditor } from "@/lib/auth/request";
import {
  getAlbumPhotoNeighbors,
  listProfiles,
  listTagsForPhoto,
  softDeletePhotos,
  updatePhoto,
} from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { photo } = await requirePhotoAccess(request, id);
    const [profiles, tags, neighbors] = await Promise.all([
      listProfiles(),
      listTagsForPhoto(id),
      getAlbumPhotoNeighbors(photo.album_id, photo.id),
    ]);
    const profile = profiles.find((p) => p.id === photo.uploaded_by) ?? null;
    return NextResponse.json({ photo, profile, tags, neighbors });
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
      latitude?: number | null;
      longitude?: number | null;
    };
    const lat =
      body.latitude === null || body.latitude === undefined
        ? body.latitude ?? undefined
        : Number(body.latitude);
    const lng =
      body.longitude === null || body.longitude === undefined
        ? body.longitude ?? undefined
        : Number(body.longitude);
    const photo = await updatePhoto(id, {
      title: body.title?.trim() || null,
      description: body.description?.trim() || null,
      locationName: body.location_name?.trim() || null,
      latitude:
        lat !== undefined && (lat === null || Number.isFinite(lat)) ? lat : undefined,
      longitude:
        lng !== undefined && (lng === null || Number.isFinite(lng)) ? lng : undefined,
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
    await softDeletePhotos([photo.id]);
    return NextResponse.json({ ok: true, trashed: true });
  } catch (err) {
    return jsonError(err);
  }
}
