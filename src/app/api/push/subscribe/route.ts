import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
} from "@/lib/auth/request";
import {
  deletePushSubscriptionByEndpoint,
  hasPushSubscription,
  upsertPushSubscription,
} from "@/lib/db/queries";
import { getVapidPublicKey } from "@/lib/push";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer(request);
    const url = new URL(request.url);
    const guestSessionId = url.searchParams.get("guestSessionId");
    const albumId =
      viewer.mode === "guest" ? viewer.albumId : url.searchParams.get("albumId");
    if (viewer.mode === "guest" && albumId) {
      await assertCanAccessAlbum(viewer, albumId);
    }
    const subscribed = await hasPushSubscription({
      userId: viewer.mode === "teilnehmer" ? viewer.user.id : null,
      guestSessionId: viewer.mode === "guest" ? guestSessionId : null,
      albumId: viewer.mode === "guest" ? albumId : null,
    });
    return NextResponse.json({
      subscribed,
      publicKey: getVapidPublicKey(),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer(request);
    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      guest_session_id?: string;
      album_id?: string;
    };
    const endpoint = body.endpoint?.trim() ?? "";
    const p256dh = body.keys?.p256dh?.trim() ?? "";
    const auth = body.keys?.auth?.trim() ?? "";
    if (!endpoint || !p256dh || !auth) {
      throw new HttpError(400, "Push-Abo unvollständig.");
    }
    const albumId = viewer.mode === "guest" ? viewer.albumId : body.album_id ?? null;
    if (albumId) await assertCanAccessAlbum(viewer, albumId);
    await upsertPushSubscription({
      endpoint,
      p256dh,
      auth,
      userId: viewer.mode === "teilnehmer" ? viewer.user.id : null,
      guestSessionId:
        viewer.mode === "guest" ? body.guest_session_id ?? null : null,
      albumId,
    });
    return NextResponse.json({ ok: true, publicKey: getVapidPublicKey() });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireViewer(request);
    const body = (await request.json()) as { endpoint?: string };
    const endpoint = body.endpoint?.trim() ?? "";
    if (!endpoint) throw new HttpError(400, "Endpoint fehlt.");
    await deletePushSubscriptionByEndpoint(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
