import { NextResponse } from "next/server";
import { jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { rotateWidgetToken } from "@/lib/widget/payload";

/** New token, and every script copied earlier stops working. */
export async function POST() {
  try {
    const user = await requireTeilnehmer();
    await rotateWidgetToken(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
