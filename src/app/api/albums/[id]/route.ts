import { NextResponse } from "next/server";
import {
  HttpError,
  jsonError,
  requireAdmin,
  requireTeilnehmer,
} from "@/lib/auth/request";
import {
  countAlbums,
  deleteAlbum,
  getAlbum,
  getPhoto,
  isAlbumMember,
  updateAlbum,
} from "@/lib/db/queries";
import { removePhotoFiles } from "@/lib/files";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const user = await requireTeilnehmer();
    const { id } = await ctx.params;
    const album = await getAlbum(id);
    if (!album) throw new HttpError(404, "Album nicht gefunden.");
    if (user.role !== "admin" && !(await isAlbumMember(id, user.id))) {
      throw new HttpError(403, "Kein Zugriff auf dieses Album.");
    }
    return NextResponse.json({ album });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireTeilnehmer();
    const { id } = await ctx.params;
    const existing = await getAlbum(id);
    if (!existing) throw new HttpError(404, "Album nicht gefunden.");
    if (user.role !== "admin" && !(await isAlbumMember(id, user.id))) {
      throw new HttpError(403, "Kein Zugriff auf dieses Album.");
    }

    const body = (await request.json()) as {
      name?: string;
      cover_photo_id?: string | null;
      starts_on?: string | null;
      ends_on?: string | null;
    };

    if (body.name != null && user.role !== "admin") {
      throw new HttpError(403, "Nur die Administration darf Alben umbenennen.");
    }
    const name = body.name?.trim();
    if (body.name != null && !name) {
      throw new HttpError(400, "Album-Name fehlt.");
    }

    if (body.cover_photo_id) {
      const photo = await getPhoto(body.cover_photo_id);
      if (!photo || photo.album_id !== id) {
        throw new HttpError(400, "Cover-Foto gehört nicht zu diesem Album.");
      }
    }

    const album = await updateAlbum(id, {
      name: name || undefined,
      coverPhotoId:
        "cover_photo_id" in body ? body.cover_photo_id : undefined,
      startsOn: "starts_on" in body ? body.starts_on : undefined,
      endsOn: "ends_on" in body ? body.ends_on : undefined,
    });
    if (!album) throw new HttpError(404, "Album nicht gefunden.");
    return NextResponse.json({ album });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    if (!(await getAlbum(id))) throw new HttpError(404, "Album nicht gefunden.");
    if ((await countAlbums()) < 2) {
      throw new HttpError(409, "Mindestens ein Album muss bleiben.");
    }
    const photos = await deleteAlbum(id);
    await removePhotoFiles(
      photos.flatMap((photo) => [photo.storage_path, photo.thumbnail_path]),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
