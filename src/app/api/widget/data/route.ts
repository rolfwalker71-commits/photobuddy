import { NextResponse } from "next/server";
import { jsonError } from "@/lib/auth/request";
import { settingsOf, widgetPayload } from "@/lib/widget/payload";
import { requireWidgetUser } from "@/lib/widget/auth";

export const dynamic = "force-dynamic";

/** Called by the Scriptable widget on the phone; the token replaces the session. */
export async function GET(request: Request) {
  try {
    const user = await requireWidgetUser(request);
    const payload = await widgetPayload(user, settingsOf(user));
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return jsonError(err);
  }
}
