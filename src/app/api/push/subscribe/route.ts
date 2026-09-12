import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireViewer,
  type Viewer,
} from "@/lib/auth/request";
import {
  deletePushSubscriptionByEndpoint,
  getPushSubscriptionByEndpoint,
  hasPushSubscription,
  setPushSubscriptionMode,
  upsertPushSubscription,
  type PushSubscriptionRow,
} from "@/lib/db/queries";
import { getDigestSettings } from "@/lib/digest";
import { getVapidPublicKey } from "@/lib/push";
import type { NotifyMode } from "@/lib/types";

function parseNotifyMode(value: unknown): NotifyMode | null {
  return value === "instant" || value === "daily" ? value : null;
}

function ownsSubscription(viewer: Viewer, sub: PushSubscriptionRow) {
  if (viewer.mode === "teilnehmer") return sub.user_id === viewer.user.id;
  return !sub.user_id && sub.album_id === viewer.albumId;
}

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
    const { hour: digestHour } = await getDigestSettings();
    // With this device's endpoint we can answer exactly, including its mode.
    const endpoint = url.searchParams.get("endpoint");
    if (endpoint) {
      const sub = await getPushSubscriptionByEndpoint(endpoint);
      const owned = sub && ownsSubscription(viewer, sub) ? sub : null;
      return NextResponse.json({
        subscribed: Boolean(owned),
        notify_mode: owned?.notify_mode ?? null,
        digest_hour: digestHour,
        publicKey: getVapidPublicKey(),
      });
    }
    const subscribed = await hasPushSubscription({
      userId: viewer.mode === "teilnehmer" ? viewer.user.id : null,
      guestSessionId: viewer.mode === "guest" ? guestSessionId : null,
      albumId: viewer.mode === "guest" ? albumId : null,
    });
    return NextResponse.json({
      subscribed,
      notify_mode: null,
      digest_hour: digestHour,
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
      notify_mode?: string;
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
      notifyMode: parseNotifyMode(body.notify_mode),
    });
    return NextResponse.json({ ok: true, publicKey: getVapidPublicKey() });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const viewer = await requireViewer(request);
    const body = (await request.json()) as {
      endpoint?: string;
      notify_mode?: string;
    };
    const endpoint = body.endpoint?.trim() ?? "";
    const mode = parseNotifyMode(body.notify_mode);
    if (!endpoint || !mode) throw new HttpError(400, "Endpoint oder Modus fehlt.");
    const sub = await getPushSubscriptionByEndpoint(endpoint);
    if (!sub || !ownsSubscription(viewer, sub)) {
      throw new HttpError(404, "Push-Abo nicht gefunden.");
    }
    await setPushSubscriptionMode(endpoint, mode);
    return NextResponse.json({ ok: true, notify_mode: mode });
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
