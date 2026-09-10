import { NextResponse } from "next/server";
import { HttpError, jsonError, requireViewer } from "@/lib/auth/request";
import { reverseGeocode } from "@/lib/geocode";

export async function GET(request: Request) {
  try {
    await requireViewer(request);
    const url = new URL(request.url);
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new HttpError(400, "Koordinaten fehlen.");
    }
    const { place, nominatimError } = await reverseGeocode(latitude, longitude);
    return NextResponse.json({ place_name: place, nominatim_error: nominatimError });
  } catch (err) {
    return jsonError(err);
  }
}
