import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireTeilnehmer,
} from "@/lib/auth/request";
import { deleteApnsDeviceByToken, upsertApnsDevice } from "@/lib/db/queries";
import { isApnsEnvironment } from "@/lib/push/apns";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireTeilnehmer();
    const body = (await request.json().catch(() => ({}))) as {
      token?: string;
      environment?: string;
      albumId?: string | null;
      notifyMode?: string;
    };
    const token = body.token?.trim() ?? "";
    if (!/^[0-9a-fA-F]{32,200}$/.test(token)) {
      throw new HttpError(400, "Geräte-Token fehlt oder ist ungültig.");
    }
    if (!isApnsEnvironment(body.environment)) {
      throw new HttpError(400, "Umgebung muss «sandbox» oder «production» sein.");
    }
    if (
      body.notifyMode != null &&
      body.notifyMode !== "instant" &&
      body.notifyMode !== "daily"
    ) {
      throw new HttpError(400, "Modus muss «instant» oder «daily» sein.");
    }
    const albumId = body.albumId || null;
    if (albumId) {
      await assertCanAccessAlbum(
        { mode: "teilnehmer", user, shareKey: null, albumId: null },
        albumId,
      );
    }
    await upsertApnsDevice({
      userId: user.id,
      token: token.toLowerCase(),
      environment: body.environment,
      albumId,
      notifyMode: body.notifyMode ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireTeilnehmer();
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    const token = body.token?.trim().toLowerCase() ?? "";
    if (!token) throw new HttpError(400, "Geräte-Token fehlt.");
    await deleteApnsDeviceByToken(token, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
