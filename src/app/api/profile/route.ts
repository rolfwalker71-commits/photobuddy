import { NextResponse } from "next/server";
import { HttpError, jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { toProfile } from "@/lib/db/mappers";
import { findUserById, listShareLinks, updateUserProfile } from "@/lib/db/queries";

export async function GET() {
  try {
    const user = await requireTeilnehmer();
    const row = await findUserById(user.id);
    if (!row) throw new HttpError(401, "Bitte zuerst anmelden.");
    return NextResponse.json({
      profile: toProfile(row),
      shareLinks: await listShareLinks(),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireTeilnehmer();
    const body = (await request.json()) as {
      display_name?: string;
      accent_color?: string;
    };
    const row = await updateUserProfile(user.id, {
      displayName: body.display_name?.trim() || user.display_name,
      accentColor: body.accent_color || user.accent_color,
    });
    if (!row) throw new HttpError(404, "Profil nicht gefunden.");
    return NextResponse.json({ profile: toProfile(row) });
  } catch (err) {
    return jsonError(err);
  }
}
