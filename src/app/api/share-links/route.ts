import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth/request";
import { listShareLinks } from "@/lib/db/queries";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ shareLinks: await listShareLinks() });
  } catch (err) {
    return jsonError(err);
  }
}
