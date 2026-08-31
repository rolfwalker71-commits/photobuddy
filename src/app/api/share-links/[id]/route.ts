import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth/request";
import { setShareLinkActive } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = (await request.json()) as { is_active?: boolean };
    await setShareLinkActive(id, Boolean(body.is_active));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
