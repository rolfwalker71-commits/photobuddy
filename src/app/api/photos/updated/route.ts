import { NextResponse } from "next/server";
import { jsonError, requireViewer } from "@/lib/auth/request";
import { getPhotosUpdatedStamp } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireViewer(request);
    const stamp = await getPhotosUpdatedStamp();
    return NextResponse.json(
      { stamp },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}