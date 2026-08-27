import { NextResponse } from "next/server";
import { getSessionUser, jsonError, HttpError } from "@/lib/auth/request";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Bitte zuerst anmelden.");
    return NextResponse.json({ user });
  } catch (err) {
    return jsonError(err);
  }
}
