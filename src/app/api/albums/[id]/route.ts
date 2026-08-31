import { NextResponse } from "next/server";
import {
  HttpError,
  jsonError,
  requireAdmin,
  requireTeilnehmer,
} from "@/lib/auth/request";
import {
  countAlbums,
  countPhotosInAlbum,
  deleteAlbum,
  getAlbum,
  isAlbumMember,
  renameAlbum,
} from "@/lib/db/queries";

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
    await requireAdmin();
    const { id } = await ctx.params;
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim() ?? "";
    if (!name) throw new HttpError(400, "Album-Name fehlt.");
    const album = await renameAlbum(id, name);
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
      throw new HttpError(409, "Das letzte Album kann nicht gelöscht werden.");
    }
    if ((await countPhotosInAlbum(id)) > 0) {
      throw new HttpError(409, "Album hat noch Fotos. Zuerst die Fotos entfernen.");
    }
    await deleteAlbum(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
