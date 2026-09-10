import { NextResponse } from "next/server";
import { HttpError, jsonError, requirePhotoEditor } from "@/lib/auth/request";
import { setPhotoHighlight } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await requirePhotoEditor(request, id);
    const body = (await request.json()) as { is_highlight?: boolean };
    if (typeof body.is_highlight !== "boolean") {
      throw new HttpError(400, "is_highlight fehlt.");
    }
    const photo = await setPhotoHighlight(id, body.is_highlight);
    if (!photo) throw new HttpError(404, "Foto nicht gefunden.");
    return NextResponse.json({ photo });
  } catch (err) {
    return jsonError(err);
  }
}
