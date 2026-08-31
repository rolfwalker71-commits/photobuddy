import { NextResponse } from "next/server";
import { HttpError, jsonError, requireAdmin } from "@/lib/auth/request";
import {
  ensureShareLink,
  getAlbum,
  rotateShareLink,
  setAlbumShareLinkActive,
} from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireAdmin();
    const { id } = await ctx.params;
    if (!(await getAlbum(id))) throw new HttpError(404, "Album nicht gefunden.");
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const shareLink =
      body.action === "rotate"
        ? await rotateShareLink(id, user.id)
        : await ensureShareLink(id, user.id);
    return NextResponse.json({ shareLink, album: await getAlbum(id) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    if (!(await getAlbum(id))) throw new HttpError(404, "Album nicht gefunden.");
    const body = (await request.json()) as { is_active?: boolean };
    const shareLink = await setAlbumShareLinkActive(id, Boolean(body.is_active));
    return NextResponse.json({ shareLink, album: await getAlbum(id) });
  } catch (err) {
    return jsonError(err);
  }
}
