import { bearerMatchesAuthSecret, jsonError, requireAdmin } from "@/lib/auth/request";
import { backupFilename, createBackupStream } from "@/lib/backup";
import { contentDispositionAttachment } from "@/lib/zip-download";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

/**
 * Full backup as ZIP. Admin session, or `Authorization: Bearer $AUTH_SECRET`
 * for cron (scripts/backup.sh). `?photos=0` skips media for a small DB-only copy.
 */
export async function GET(request: Request) {
  try {
    if (!bearerMatchesAuthSecret(request)) await requireAdmin();
    const withPhotos = new URL(request.url).searchParams.get("photos") !== "0";
    const stream = await createBackupStream({ withPhotos });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDispositionAttachment(
          backupFilename(new Date(), withPhotos),
        ),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
