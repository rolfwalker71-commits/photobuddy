import { NextResponse } from "next/server";
import { jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { deleteComment } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    await requireTeilnehmer();
    const { id } = await ctx.params;
    await deleteComment(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
