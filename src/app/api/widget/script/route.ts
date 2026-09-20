import { HttpError, jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { findUserById } from "@/lib/db/queries";
import { ensureWidgetToken } from "@/lib/widget/payload";
import { buildWidgetScript } from "@/lib/widget/script";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * The address the phone should call. Whatever the browser is on wins — the
 * same install is reached as a LAN IP at home and as a domain on the road, and
 * the script has to carry the one the Teilnehmer is actually using.
 */
function baseFrom(request: Request) {
  const requested = new URL(request.url).searchParams.get("base");
  if (requested) {
    try {
      const url = new URL(requested);
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    } catch {
      /* fall through to the configured address */
    }
  }
  const site = getPublicEnv().NEXT_PUBLIC_SITE_URL;
  if (site) return site.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  try {
    const profile = await requireTeilnehmer();
    const user = await findUserById(profile.id);
    if (!user) throw new HttpError(401, "Bitte zuerst anmelden.");

    const token = await ensureWidgetToken(user);
    const script = buildWidgetScript(baseFrom(request), token);

    return new Response(script, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="Photobuddy.js"',
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
