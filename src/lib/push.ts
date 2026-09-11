import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import webpush from "web-push";
import {
  deletePushSubscriptionByEndpoint,
  getAlbum,
  getPhoto,
  getShareLinkForAlbum,
  listPushSubscriptionsForAlbumNotify,
  listPushSubscriptionsForUser,
} from "@/lib/db/queries";

type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

let cached: VapidKeys | null = null;

function vapidDir() {
  return process.env.VAPID_DIR || "/data/vapid";
}

function keysPath() {
  return join(vapidDir(), "keys.json");
}

function readStoredKeys() {
  const path = keysPath();
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      publicKey?: string;
      public?: string;
      privateKey?: string;
      private?: string;
    };
    const publicKey = raw.publicKey || raw.public || "";
    const privateKey = raw.privateKey || raw.private || "";
    if (!publicKey || !privateKey) return null;
    return { publicKey, privateKey };
  } catch {
    return null;
  }
}

function persistKeys(publicKey: string, privateKey: string) {
  try {
    mkdirSync(vapidDir(), { recursive: true });
    writeFileSync(
      keysPath(),
      JSON.stringify({ publicKey, privateKey }, null, 2),
    );
  } catch {
    /* volume may be read-only outside Docker */
  }
}

export function getVapidKeys(): VapidKeys {
  if (cached) return cached;
  let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  let privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:photobuddy@localhost";

  if (!publicKey || !privateKey) {
    const stored = readStoredKeys();
    if (stored) {
      publicKey = stored.publicKey;
      privateKey = stored.privateKey;
    } else {
      const generated = webpush.generateVAPIDKeys();
      publicKey = generated.publicKey;
      privateKey = generated.privateKey;
      persistKeys(publicKey, privateKey);
    }
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = publicKey;
    process.env.VAPID_PRIVATE_KEY = privateKey;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  cached = { publicKey, privateKey, subject };
  return cached;
}

export function getVapidPublicKey() {
  return getVapidKeys().publicKey;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag?: string;
};

export async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
) {
  try {
    getVapidKeys();
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await deletePushSubscriptionByEndpoint(sub.endpoint);
      return;
    }
    console.error("push send failed", status, err);
  }
}

export async function notifyNewPhoto(input: {
  photoId: string;
  albumId: string;
  uploaderId: string;
  uploaderName: string;
}) {
  try {
    const album = await getAlbum(input.albumId);
    const albumName = album?.name ?? "Album";
    const share = await getShareLinkForAlbum(input.albumId);
    const memberUrl = `/photos/${input.photoId}`;
    const guestUrl = share
      ? `/gallery/share/photos/${input.photoId}?key=${encodeURIComponent(share.key)}`
      : "/gallery/share";

    const subs = await listPushSubscriptionsForAlbumNotify(input.albumId);
    const seen = new Set<string>();
    await Promise.all(
      subs.map((sub) => {
        if (seen.has(sub.endpoint)) return;
        seen.add(sub.endpoint);
        // Daily subscribers get the evening summary instead (src/lib/digest.ts).
        if (sub.notify_mode === "daily") return;
        if (sub.user_id && sub.user_id === input.uploaderId) return;
        const isGuest = !sub.user_id;
        return sendPush(sub, {
          title: albumName,
          body: `${input.uploaderName} hat ein Foto geteilt.`,
          url: isGuest ? guestUrl : memberUrl,
          tag: `album-${input.albumId}`,
        });
      }),
    );
  } catch (err) {
    console.error("notifyNewPhoto", err);
  }
}

export async function notifyNewComment(input: {
  photoId: string;
  commenterName: string;
  commenterUserId?: string | null;
}) {
  try {
    const photo = await getPhoto(input.photoId);
    if (!photo) return;
    if (input.commenterUserId && input.commenterUserId === photo.uploaded_by) {
      return;
    }
    const subs = await listPushSubscriptionsForUser(photo.uploaded_by);
    const payload: PushPayload = {
      title: "Photobuddy",
      body: `${input.commenterName} hat geschrieben.`,
      url: `/photos/${input.photoId}`,
    };
    await Promise.all(subs.map((sub) => sendPush(sub, payload)));
  } catch (err) {
    console.error("notifyNewComment", err);
  }
}

