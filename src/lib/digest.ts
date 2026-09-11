import {
  claimDigest,
  getAppSetting,
  getPreviousDigestSentAt,
  getShareLinkForAlbum,
  listAlbums,
  listPhotosCreatedBetween,
  listPushSubscriptionsForAlbumNotify,
  setDigestPhotoCount,
} from "@/lib/db/queries";
import {
  DEFAULT_DIGEST_HOUR,
  DEFAULT_DIGEST_TIME_ZONE,
  digestBody,
  isValidTimeZone,
  localDateAndHour,
  parseDigestHour,
  summarizeDigest,
} from "@/lib/digest-text";
import { sendPush } from "@/lib/push";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getDigestSettings() {
  const [hour, timeZone] = await Promise.all([
    getAppSetting("digest_hour"),
    getAppSetting("digest_time_zone"),
  ]);
  return {
    hour: parseDigestHour(hour) ?? DEFAULT_DIGEST_HOUR,
    timeZone: isValidTimeZone(timeZone) ? timeZone : DEFAULT_DIGEST_TIME_ZONE,
  };
}

export type DigestRunResult = {
  date: string;
  due: boolean;
  albums: number;
  sent: number;
};

/**
 * Evening summary for subscriptions in "daily" mode: one push per album with
 * everything uploaded since the previous summary. Safe to call often — each
 * album/day is claimed once in push_digests. `test` sends right away without
 * claiming the day, so the regular evening summary still goes out.
 */
export async function runDailyDigest(
  opts: { now?: Date; test?: boolean } = {},
): Promise<DigestRunResult> {
  const now = opts.now ?? new Date();
  const settings = await getDigestSettings();
  const { date, hour } = localDateAndHour(now, settings.timeZone);
  if (!opts.test && hour < settings.hour) {
    return { date, due: false, albums: 0, sent: 0 };
  }

  let albums = 0;
  let sent = 0;
  for (const album of await listAlbums()) {
    const previous = await getPreviousDigestSentAt(album.id, date);
    if (!opts.test && !(await claimDigest(album.id, date))) continue;
    const since = previous ?? new Date(now.getTime() - DAY_MS);
    const rows = await listPhotosCreatedBetween(album.id, since, now);
    if (!opts.test) await setDigestPhotoCount(album.id, date, rows.length);
    if (rows.length === 0) continue;
    albums += 1;

    const [subs, share] = await Promise.all([
      listPushSubscriptionsForAlbumNotify(album.id),
      getShareLinkForAlbum(album.id),
    ]);
    const seen = new Set<string>();
    for (const sub of subs) {
      if (sub.notify_mode !== "daily" || seen.has(sub.endpoint)) continue;
      seen.add(sub.endpoint);
      const isGuest = !sub.user_id;
      if (isGuest && !share?.is_active) continue;
      // Participants don't need to hear about their own uploads.
      const summary = summarizeDigest(rows, isGuest ? null : sub.user_id);
      if (summary.count === 0) continue;
      await sendPush(sub, {
        title: album.name,
        body: digestBody(summary),
        url:
          isGuest && share
            ? `/gallery/share?key=${encodeURIComponent(share.key)}`
            : "/gallery",
        tag: `digest-${album.id}`,
      });
      sent += 1;
    }
  }
  return { date, due: true, albums, sent };
}
