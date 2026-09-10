import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireAdmin,
  requireTeilnehmer,
} from "@/lib/auth/request";
import {
  ensureShareLink,
  getAlbum,
  getShareLinkForAlbum,
  rotateShareLink,
  setAlbumShareLinkActive,
} from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireTeilnehmer();
    const { id } = await ctx.params;
    if (!(await getAlbum(id))) throw new HttpError(404, "Album nicht gefunden.");
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      id,
    );
    const shareLink = await getShareLinkForAlbum(id);
    return NextResponse.json({ shareLink });
  } catch (err) {
    return jsonError(err);
  }
}

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
