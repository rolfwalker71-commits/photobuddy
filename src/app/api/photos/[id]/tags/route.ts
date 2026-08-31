import { NextResponse } from "next/server";
import { HttpError, jsonError, requirePhotoEditor } from "@/lib/auth/request";
import { addTagToPhoto } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await requirePhotoEditor(request, id);
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim() ?? "";
    if (!name) throw new HttpError(400, "Tag-Name fehlt.");
    const tag = await addTagToPhoto(id, name);
    return NextResponse.json({ tag });
  } catch (err) {
    return jsonError(err);
  }
}
