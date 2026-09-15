import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  HttpError,
  assertCanAccessAlbum,
  jsonError,
  requireEditor,
  requireTeilnehmer,
} from "@/lib/auth/request";
import { listPhotosByIds } from "@/lib/db/queries";
import { resolvePhotoPath } from "@/lib/files";
import {
  GRAV_DIARY_ROUTE,
  createGravPost,
  getGravPage,
  gravConfig,
  gravSlug,
  listGravAuthors,
  listGravMedia,
  listGravPosts,
  saveGravMediaMeta,
  updateGravHeader,
  uploadGravMedia,
} from "@/lib/grav";
import { mimeFromPath } from "@/lib/mime";
import type { Photo } from "@/lib/types";

export const dynamic = "force-dynamic";

const LOCAL_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/** Stable per photo, so publishing the same photo twice is detected and skipped. */
function mediaFilename(photo: Photo) {
  const ext = (photo.storage_path.split(".").pop() ?? "jpg").toLowerCase();
  return `photobuddy-${photo.id.slice(0, 8)}.${ext}`;
}

function mediaMeta(photo: Photo, place: string) {
  const caption = photo.title?.trim() || "";
  const description = photo.description?.trim() || "";
  const fields: Record<string, string> = {};
  if (caption || description) fields.bildtext = caption || description;
  const alt = description || caption || (place ? `Foto aus ${place}` : "");
  if (alt) fields.alt = alt;
  return fields;
}

/** GET: is publishing set up? With ?details=1 also the site's authors and posts. */
export async function GET(request: Request) {
  try {
    await requireTeilnehmer();
    const config = gravConfig();
    if (!config) return NextResponse.json({ configured: false });
    if (new URL(request.url).searchParams.get("details") !== "1") {
      return NextResponse.json({ configured: true, site: config.url });
    }
    const [authors, posts] = await Promise.all([listGravAuthors(), listGravPosts()]);
    return NextResponse.json(
      { configured: true, site: config.url, authors, posts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}

type PublishBody = {
  albumId?: string;
  photoIds?: unknown;
  route?: string;
  post?: {
    title?: string;
    date?: string;
    autor?: string;
    ort?: string;
    intro?: string;
    text?: string;
    published?: boolean;
  };
};

async function createPost(post: NonNullable<PublishBody["post"]>) {
  const title = post.title?.trim() ?? "";
  if (!title) throw new HttpError(400, "Titel fehlt.");
  const match = LOCAL_DATETIME_RE.exec(post.date ?? "");
  if (!match) throw new HttpError(400, "Datum fehlt.");
  const [, day, time] = match;

  const base = `${GRAV_DIARY_ROUTE}/${day}-${gravSlug(post.ort?.trim() || title) || "beitrag"}`;
  let route = base;
  for (let n = 2; await getGravPage(route); n += 1) {
    if (n > 20) throw new HttpError(409, "Zu viele Beiträge mit diesem Namen.");
    route = `${base}-${n}`;
  }

  await createGravPost({
    route,
    title,
    content: post.text?.trim() ?? "",
    header: {
      // Wall-clock time as a quoted string: the site reads it as local time.
      date: `${day} ${time}`,
      autor: post.autor?.trim() || "alle",
      ort: post.ort?.trim() ?? "",
      intro: post.intro?.trim() ?? "",
      published: post.published === true,
    },
  });
  return route;
}

export async function POST(request: Request) {
  try {
    const user = await requireEditor(request);
    if (!gravConfig()) {
      throw new HttpError(503, "Webseite nicht eingerichtet (GRAV_URL / GRAV_API_KEY).");
    }
    const body = (await request.json()) as PublishBody;
    const albumId = String(body.albumId ?? "").trim();
    if (!albumId) throw new HttpError(400, "Album fehlt.");
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      albumId,
    );

    const ids = Array.isArray(body.photoIds) ? body.photoIds.map(String) : [];
    const photos = (await listPhotosByIds(albumId, ids)).filter(
      (photo) => photo.kind === "photo",
    );
    if (photos.length === 0) throw new HttpError(400, "Keine Fotos ausgewählt (Videos werden nicht übertragen).");

    let route: string;
    let created = false;
    if (body.post) {
      route = await createPost(body.post);
      created = true;
    } else {
      route = `/${String(body.route ?? "").trim().replace(/^\/+|\/+$/g, "")}`;
      if (!route.startsWith(`${GRAV_DIARY_ROUTE}/`)) {
        throw new HttpError(400, "Beitrag fehlt.");
      }
    }

    const page = await getGravPage(route);
    if (!page) throw new HttpError(404, "Beitrag auf der Webseite nicht gefunden.");
    const place = String(page.header?.ort ?? body.post?.ort ?? "").trim();

    const existing = (await listGravMedia(route)).map((media) => media.filename);
    const present = new Set(existing);
    const uploaded: string[] = [];
    for (const photo of photos) {
      const filename = mediaFilename(photo);
      if (present.has(filename)) continue;
      const data = await readFile(resolvePhotoPath(photo.storage_path));
      await uploadGravMedia(route, {
        filename,
        mime: photo.mime_type || mimeFromPath(photo.storage_path, "image/jpeg"),
        data,
      });
      const fields = mediaMeta(photo, place);
      if (Object.keys(fields).length > 0) {
        await saveGravMediaMeta(route, filename, fields);
      }
      uploaded.push(filename);
      present.add(filename);
    }

    if (uploaded.length > 0) {
      const order = String(page.header?.media_order ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      const ordered = order.length > 0 ? order : existing;
      const header: Record<string, unknown> = {
        media_order: [...ordered, ...uploaded.filter((name) => !ordered.includes(name))].join(","),
      };
      if (!page.header?.titelbild) header.titelbild = ordered[0] ?? uploaded[0];
      await updateGravHeader(route, header);
    }

    const site = gravConfig()!.url;
    return NextResponse.json({
      route,
      created,
      published: created ? body.post?.published === true : page.published,
      url: `${site}${route}`,
      panelUrl: `${site}/admin`,
      uploaded: uploaded.length,
      skipped: photos.length - uploaded.length,
    });
  } catch (err) {
    return jsonError(err);
  }
}
