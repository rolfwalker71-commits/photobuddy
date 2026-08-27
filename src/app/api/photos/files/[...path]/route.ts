import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { HttpError, jsonError, requireViewer } from "@/lib/auth/request";
import { resolvePhotoPath } from "@/lib/files";

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requireViewer(request);
    const { path } = await ctx.params;
    const relative = path.map(decodeURIComponent).join("/");
    const absolute = resolvePhotoPath(relative);
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) throw new HttpError(404, "Datei nicht gefunden.");

    const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(info.size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
