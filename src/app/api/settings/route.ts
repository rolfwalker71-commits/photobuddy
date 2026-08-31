import { NextResponse } from "next/server";
import { HttpError, jsonError, requireAdmin } from "@/lib/auth/request";
import { getAppSetting, setAppSetting } from "@/lib/db/queries";
import { DEFAULT_MAP_STYLE, isMapStyleId, parseMapStyleId } from "@/lib/map-styles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = await getAppSetting("map_style");
    return NextResponse.json(
      { map_style: parseMapStyleId(raw ?? DEFAULT_MAP_STYLE) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { map_style?: unknown };
    if (!isMapStyleId(body.map_style)) {
      throw new HttpError(400, "Unbekannter Kartenstil.");
    }
    await setAppSetting("map_style", body.map_style);
    return NextResponse.json({ map_style: body.map_style });
  } catch (err) {
    return jsonError(err);
  }
}
