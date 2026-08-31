import { NextResponse } from "next/server";
import { HttpError, jsonError, requireAdmin } from "@/lib/auth/request";
import { getAlbum, setAlbumMembers } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    if (!(await getAlbum(id))) throw new HttpError(404, "Album nicht gefunden.");
    const body = (await request.json()) as { user_ids?: string[] };
    const userIds = Array.isArray(body.user_ids) ? body.user_ids : [];
    await setAlbumMembers(id, userIds);
    const album = await getAlbum(id);
    return NextResponse.json({ album });
  } catch (err) {
    return jsonError(err);
  }
}
