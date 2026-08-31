import { NextResponse } from "next/server";
import { getSessionUser, jsonError, HttpError } from "@/lib/auth/request";
import { listAlbums, listAlbumsForUser } from "@/lib/db/queries";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Bitte zuerst anmelden.");
    const albums =
      user.role === "admin" ? await listAlbums() : await listAlbumsForUser(user.id);
    return NextResponse.json({ user, albums });
  } catch (err) {
    return jsonError(err);
  }
}
