import { NextResponse } from "next/server";
import { jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { createShareLink, listShareLinks } from "@/lib/db/queries";

export async function GET() {
  try {
    await requireTeilnehmer();
    return NextResponse.json({ shareLinks: await listShareLinks() });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST() {
  try {
    const user = await requireTeilnehmer();
    const key = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
    const link = await createShareLink({ key, createdBy: user.id });
    return NextResponse.json({ shareLink: link });
  } catch (err) {
    return jsonError(err);
  }
}
