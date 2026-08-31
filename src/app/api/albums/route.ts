import { NextResponse } from "next/server";
import { HttpError, jsonError, requireAdmin, requireTeilnehmer } from "@/lib/auth/request";
import { createAlbum, listAlbums, listAlbumsForUser } from "@/lib/db/queries";

export async function GET() {
  try {
    const user = await requireTeilnehmer();
    const albums =
      user.role === "admin" ? await listAlbums() : await listAlbumsForUser(user.id);
    return NextResponse.json({ albums });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = (await request.json()) as {
      name?: string;
      member_ids?: string[];
    };
    const name = body.name?.trim() ?? "";
    if (!name) throw new HttpError(400, "Album-Name fehlt.");
    const album = await createAlbum({
      name,
      createdBy: user.id,
      memberIds: Array.isArray(body.member_ids) ? body.member_ids : [],
    });
    return NextResponse.json({ album });
  } catch (err) {
    return jsonError(err);
  }
}
