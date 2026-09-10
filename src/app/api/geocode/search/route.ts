import { NextResponse } from "next/server";
import { HttpError, jsonError, requireViewer } from "@/lib/auth/request";
import { forwardGeocode } from "@/lib/geocode";

export async function GET(request: Request) {
  try {
    await requireViewer(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    if (!q) {
      throw new HttpError(400, "Suchbegriff fehlt.");
    }
    const { results, nominatimError } = await forwardGeocode(q);
    return NextResponse.json({ results, nominatim_error: nominatimError });
  } catch (err) {
    return jsonError(err);
  }
}
