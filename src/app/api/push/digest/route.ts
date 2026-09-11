import { NextResponse } from "next/server";
import { bearerMatchesAuthSecret, jsonError, requireAdmin } from "@/lib/auth/request";
import { runDailyDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";

/**
 * Test send of the evening summary; the regular one still goes out.
 * Admin session, or `Authorization: Bearer $AUTH_SECRET`.
 */
export async function POST(request: Request) {
  try {
    if (!bearerMatchesAuthSecret(request)) await requireAdmin();
    const result = await runDailyDigest({ test: true });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
