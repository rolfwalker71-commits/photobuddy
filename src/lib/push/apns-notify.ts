import {
  deleteApnsDeviceByToken,
  getAlbum,
  listApnsDevicesForAlbumNotify,
} from "@/lib/db/queries";
import { sendApns, type ApnsMessage } from "@/lib/push/apns";

/** Sends to devices and forgets the ones APNs reports as dead. */
export async function pushToApnsDevices(
  devices: Array<{ token: string; environment: "sandbox" | "production" }>,
  message: ApnsMessage,
) {
  const results = await sendApns(devices, message);
  for (const r of results) {
    if (r.dead) await deleteApnsDeviceByToken(r.token);
  }
  return results.length;
}

/** Same semantics as the web push: instant devices of album members, not the uploader. */
export async function notifyNewPhotoApns(input: {
  photoId: string;
  albumId: string;
  uploaderId: string;
  uploaderName: string;
}) {
  try {
    const devices = (await listApnsDevicesForAlbumNotify(input.albumId)).filter(
      (d) => d.notify_mode === "instant" && d.user_id !== input.uploaderId,
    );
    if (devices.length === 0) return;
    const album = await getAlbum(input.albumId);
    await pushToApnsDevices(devices, {
      title: album?.name ?? "Album",
      body: `${input.uploaderName} hat ein Foto geteilt.`,
      albumId: input.albumId,
      photoId: input.photoId,
    });
  } catch (err) {
    console.error("notifyNewPhotoApns", err);
  }
}
