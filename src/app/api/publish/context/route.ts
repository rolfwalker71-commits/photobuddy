import { NextResponse } from "next/server";
import { HttpError, jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { gravPublishContext } from "@/lib/publish-context-grav";

export const dynamic = "force-dynamic";

const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const AUTHOR_RE = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * GET ?autor=<key>&date=<YYYY-MM-DDTHH:mm>: trip facts around the date, the author's
 * style samples and the previous post. Best effort: lookups that fail come back empty.
 */
export async function GET(request: Request) {
  try {
    await requireTeilnehmer();
    const params = new URL(request.url).searchParams;
    const date = (params.get("date") ?? "").trim();
    if (!LOCAL_DATETIME_RE.test(date)) {
      throw new HttpError(400, "date muss das Format YYYY-MM-DDTHH:mm haben.");
    }
    const raw = (params.get("autor") ?? "").trim();
    const autor = AUTHOR_RE.test(raw) ? raw : "";
    return NextResponse.json(await gravPublishContext(autor, date));
  } catch (err) {
    return jsonError(err);
  }
}
