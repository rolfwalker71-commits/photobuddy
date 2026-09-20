import { HttpError } from "@/lib/auth/request";
import { findUserByWidgetToken } from "@/lib/db/queries";
import type { UserRow } from "@/lib/db/mappers";

/**
 * The widget's stand-in for a session cookie. Scriptable cannot hold a cookie
 * jar across refreshes, so the token travels in the query string — which is
 * why the endpoints that accept it are read-only, and why rotating it in the
 * app invalidates every copy of the script at once.
 */
export async function requireWidgetUser(request: Request): Promise<UserRow> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (token.length < 20) {
    throw new HttpError(401, "Widget-Link fehlt.");
  }
  const user = await findUserByWidgetToken(token);
  if (!user) {
    throw new HttpError(
      401,
      "Widget-Link ungültig — in der App unter Einstellungen → Widgets das Skript neu kopieren.",
    );
  }
  return user;
}
