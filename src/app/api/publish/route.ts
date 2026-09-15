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
import { reverseGeocode } from "@/lib/geocode";
import {
  GRAV_DIARY_ROUTE,
  GRAV_PHOTOS_ROUTE,
  createGravPost,
  getGravPage,
  gravConfig,
  gravSlug,
  listGravAuthors,
  listGravChapters,
  listGravMedia,
  listGravPosts,
  saveGravMediaMeta,
  updateGravHeader,
  uploadGravMedia,
} from "@/lib/grav";
import { mimeFromPath } from "@/lib/mime";
import { humanLocationName } from "@/lib/place";
import type { Photo } from "@/lib/types";

export const dynamic = "force-dynamic";

const LOCAL_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;
const MEDIA_DATUM_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const CHAPTER_KEY_RE = /^[a-z0-9_-]{1,40}$/;

type PhotoMeta = { datum?: string; abschnitt?: string };

/** Stable per photo, so publishing the same photo twice is detected and skipped. */
function mediaFilename(photo: Photo) {
  const ext = (photo.storage_path.split(".").pop() ?? "jpg").toLowerCase();
  return `photobuddy-${photo.id.slice(0, 8)}.${ext}`;
}

/** Place name per photo: its saved name, else looked up from its coordinates (once per spot). */
function placeResolver() {
  const cache = new Map<string, Promise<string>>();
  return (photo: Photo): Promise<string> => {
    const saved = humanLocationName(photo.location_name);
    if (saved) return Promise.resolve(saved);
    if (photo.latitude == null || photo.longitude == null) return Promise.resolve("");
    const spot = `${photo.latitude.toFixed(3)},${photo.longitude.toFixed(3)}`;
    let place = cache.get(spot);
    if (!place) {
      place = reverseGeocode(photo.latitude, photo.longitude)
        .then((result) => result.place?.trim() ?? "")
        .catch(() => "");
      cache.set(spot, place);
    }
    return place;
  };
}

function isCoordinate(value: number | null, limit: number): value is number {
  return value != null && Number.isFinite(value) && Math.abs(value) <= limit;
}

function mediaMeta(photo: Photo, where: string, extra: PhotoMeta | undefined) {
  const caption = photo.title?.trim() || "";
  const description = photo.description?.trim() || "";
  const fields: Record<string, string> = {};
  if (caption || description) fields.bildtext = caption || description;
  const alt = description || caption || (where ? `Foto aus ${where}` : "");
  if (alt) fields.alt = alt;
  if (where) fields.ort = where.slice(0, 80);
  // Coordinates as fields, not EXIF: the site shows them per photo and can hide them.
  if (isCoordinate(photo.latitude, 90) && isCoordinate(photo.longitude, 180)) {
    fields.lat = photo.latitude.toFixed(5);
    fields.lon = photo.longitude.toFixed(5);
  }
  // Local capture time and chapter let the site's Fotos page sort the photo in.
  if (extra?.datum && MEDIA_DATUM_RE.test(extra.datum)) fields.datum = extra.datum;
  if (extra?.abschnitt && CHAPTER_KEY_RE.test(extra.abschnitt)) {
    fields.abschnitt = extra.abschnitt;
  }
  return fields;
}

/** GET: is publishing set up? With ?details=1 also the site's authors, posts and chapters. */
export async function GET(request: Request) {
  try {
    await requireTeilnehmer();
    const config = gravConfig();
    if (!config) return NextResponse.json({ configured: false });
    if (new URL(request.url).searchParams.get("details") !== "1") {
      return NextResponse.json({ configured: true, site: config.url });
    }
    const [authors, posts, chapters] = await Promise.all([
      listGravAuthors(),
      listGravPosts(),
      listGravChapters(),
    ]);
    return NextResponse.json(
      { configured: true, site: config.url, authors, posts, chapters },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return jsonError(err);
  }
}

type PublishTarget = "fotos" | "post" | "new-post";

type PublishBody = {
  albumId?: string;
  photoIds?: unknown;
  /** Per photo id: local capture time and chapter key, computed on the device. */
  meta?: Record<string, PhotoMeta>;
  target?: PublishTarget;
  route?: string;
  post?: {
    title?: string;
    date?: string;
    autor?: string;
    ort?: string;
    intro?: string;
    text?: string;
    published?: boolean;
    /** Chapter key; the site otherwise derives the chapter from the date. */
    abschnitt?: string;
  };
};

async function createPost(post: NonNullable<PublishBody["post"]>, fallbackOrt: string) {
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
      ort: post.ort?.trim() || fallbackOrt,
      intro: post.intro?.trim() ?? "",
      published: post.published === true,
      ...(post.abschnitt && CHAPTER_KEY_RE.test(post.abschnitt)
        ? { abschnitt: post.abschnitt }
        : {}),
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
    if (photos.length === 0) {
      throw new HttpError(400, "Keine Fotos ausgewählt (Videos werden nicht übertragen).");
    }

    const placeOf = placeResolver();
    const target: PublishTarget = body.target ?? "fotos";
    let route: string = GRAV_PHOTOS_ROUTE;
    let created = false;
    if (target === "new-post") {
      if (!body.post) throw new HttpError(400, "Angaben zum Beitrag fehlen.");
      let fallbackOrt = "";
      if (!body.post.ort?.trim()) {
        for (const photo of photos) {
          fallbackOrt = await placeOf(photo);
          if (fallbackOrt) break;
        }
      }
      route = await createPost(body.post, fallbackOrt);
      created = true;
    } else if (target === "post") {
      route = `/${String(body.route ?? "").trim().replace(/^\/+|\/+$/g, "")}`;
      if (!route.startsWith(`${GRAV_DIARY_ROUTE}/`)) {
        throw new HttpError(400, "Beitrag fehlt.");
      }
    }
    const isPost = target !== "fotos";

    const page = await getGravPage(route);
    if (!page) {
      throw new HttpError(
        404,
        isPost
          ? "Beitrag auf der Webseite nicht gefunden."
          : "Seite „Fotos“ auf der Webseite nicht gefunden.",
      );
    }
    const postPlace = isPost ? String(page.header?.ort ?? "").trim() : "";

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
      const fields = mediaMeta(photo, (await placeOf(photo)) || postPlace, body.meta?.[photo.id]);
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
      if (isPost && !page.header?.titelbild) header.titelbild = ordered[0] ?? uploaded[0];
      await updateGravHeader(route, header);
    }

    const site = gravConfig()!.url;
    return NextResponse.json({
      target,
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
