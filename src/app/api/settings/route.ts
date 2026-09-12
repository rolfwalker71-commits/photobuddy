import { NextResponse } from "next/server";
import { HttpError, jsonError, requireAdmin } from "@/lib/auth/request";
import { getAppSetting, setAppSetting } from "@/lib/db/queries";
import { getDigestSettings } from "@/lib/digest";
import { isValidTimeZone, parseDigestHour } from "@/lib/digest-text";
import { DEFAULT_MAP_STYLE, isMapStyleId, parseMapStyleId } from "@/lib/map-styles";

export const dynamic = "force-dynamic";

async function currentSettings() {
  const [raw, digest] = await Promise.all([
    getAppSetting("map_style"),
    getDigestSettings(),
  ]);
  return {
    map_style: parseMapStyleId(raw ?? DEFAULT_MAP_STYLE),
    digest_hour: digest.hour,
    digest_time_zone: digest.timeZone,
  };
}

export async function GET() {
  try {
    return NextResponse.json(await currentSettings(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      map_style?: unknown;
      digest_hour?: unknown;
      digest_time_zone?: unknown;
    };
    if (body.map_style !== undefined) {
      if (!isMapStyleId(body.map_style)) {
        throw new HttpError(400, "Unbekannter Kartenstil.");
      }
      await setAppSetting("map_style", body.map_style);
    }
    if (body.digest_hour !== undefined) {
      const hour = parseDigestHour(body.digest_hour);
      if (hour == null) throw new HttpError(400, "Uhrzeit muss zwischen 0 und 23 liegen.");
      await setAppSetting("digest_hour", String(hour));
    }
    if (body.digest_time_zone !== undefined) {
      if (!isValidTimeZone(body.digest_time_zone)) {
        throw new HttpError(400, "Unbekannte Zeitzone.");
      }
      await setAppSetting("digest_time_zone", body.digest_time_zone);
    }
    return NextResponse.json(await currentSettings());
  } catch (err) {
    return jsonError(err);
  }
}
