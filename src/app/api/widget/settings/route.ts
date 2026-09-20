import { NextResponse } from "next/server";
import { jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { findUserById, setWidgetSettings } from "@/lib/db/queries";
import {
  parseWidgetSettings,
  serializeWidgetSettings,
} from "@/lib/widget/settings";
import { settingsOf, widgetPayload } from "@/lib/widget/payload";

export const dynamic = "force-dynamic";

/** Current settings plus a live payload, so the page can preview the widgets. */
export async function GET(request: Request) {
  try {
    const profile = await requireTeilnehmer();
    const user = await findUserById(profile.id);
    if (!user) return NextResponse.json({ error: "Unbekannt." }, { status: 401 });

    const settings = settingsOf(user);
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    return NextResponse.json({
      settings,
      hasToken: Boolean(user.widget_token),
      payload: preview ? await widgetPayload(user, settings) : null,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await requireTeilnehmer();
    const body = (await request.json()) as unknown;
    // Parsing fills in anything the client left out and drops anything it
    // invented, so a stale page cannot write a layout the script cannot draw.
    const settings = parseWidgetSettings(JSON.stringify(body ?? {}));
    await setWidgetSettings(profile.id, serializeWidgetSettings(settings));
    return NextResponse.json({ settings });
  } catch (err) {
    return jsonError(err);
  }
}
