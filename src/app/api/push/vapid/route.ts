import { NextResponse } from "next/server";
import { jsonError } from "@/lib/auth/request";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  try {
    return NextResponse.json({ publicKey: getVapidPublicKey() });
  } catch (err) {
    return jsonError(err);
  }
}
