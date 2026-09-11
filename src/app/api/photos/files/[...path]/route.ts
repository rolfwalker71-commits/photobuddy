import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { HttpError, jsonError, requireViewer } from "@/lib/auth/request";
import { resolvePhotoPath } from "@/lib/files";
import { mimeFromPath } from "@/lib/mime";

type Ctx = { params: Promise<{ path: string[] }> };

function parseRange(header: string | null, size: number) {
  if (!header?.startsWith("bytes=")) return null;
  const [startRaw, endRaw] = header.slice(6).split("-");
  const start = startRaw ? Number(startRaw) : 0;
  const end = endRaw ? Number(endRaw) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start < 0) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requireViewer(request);
    const { path } = await ctx.params;
    const relative = path.map(decodeURIComponent).join("/");
    const absolute = resolvePhotoPath(relative);
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) throw new HttpError(404, "Datei nicht gefunden.");

    const mime = mimeFromPath(relative, "application/octet-stream");
    const range = parseRange(request.headers.get("range"), info.size);
    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    };

    if (range) {
      const length = range.end - range.start + 1;
      headers["Content-Length"] = String(length);
      headers["Content-Range"] = `bytes ${range.start}-${range.end}/${info.size}`;
      const stream = Readable.toWeb(
        createReadStream(absolute, { start: range.start, end: range.end }),
      ) as ReadableStream;
      return new Response(stream, { status: 206, headers });
    }

    headers["Content-Length"] = String(info.size);
    const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;
    return new Response(stream, { headers });
  } catch (err) {
    return jsonError(err);
  }
}
