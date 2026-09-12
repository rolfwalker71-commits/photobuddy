import { runDailyDigest } from "@/lib/digest";

const CHECK_EVERY_MS = 5 * 60 * 1000;

declare global {
  var __photobuddyDigestTimer: ReturnType<typeof setInterval> | undefined;
}

/** In-process timer; push_digests rows keep several instances from double-sending. */
export function startDigestScheduler() {
  if (globalThis.__photobuddyDigestTimer || !process.env.DATABASE_URL) return;
  const tick = () => {
    runDailyDigest().catch((err) => console.error("digest", err));
  };
  globalThis.__photobuddyDigestTimer = setInterval(tick, CHECK_EVERY_MS);
  globalThis.__photobuddyDigestTimer.unref?.();
  setTimeout(tick, 30_000).unref?.();
}
