import { NextResponse } from "next/server";
import { HttpError, jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { addTagToPhoto, getPhoto } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    await requireTeilnehmer();
    const { id } = await ctx.params;
    if (!(await getPhoto(id))) throw new HttpError(404, "Foto nicht gefunden.");
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim() ?? "";
    if (!name) throw new HttpError(400, "Tag-Name fehlt.");
    const tag = await addTagToPhoto(id, name);
    return NextResponse.json({ tag });
  } catch (err) {
    return jsonError(err);
  }
}
