import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { randomBytes } from "node:crypto";
import { HttpError } from "@/lib/auth/request";
import { isSiteChapter, type SiteChapter } from "@/lib/site-chapters";

/**
 * Client for the Grav API plugin (`/api/v1`) of the trip website.
 * Server-only: the API key never reaches the browser.
 *
 * The site stores diary posts as `/tagebuch/<yyyy-mm-dd-slug>/beitrag.md`;
 * photos are page media with `alt` / `bildtext` in `.meta.yaml`. The site's
 * Fotos page collects them automatically.
 */

export const GRAV_DIARY_ROUTE = "/tagebuch";
export const GRAV_PHOTOS_ROUTE = "/fotos";
const GRAV_PEOPLE_ROUTE = "/reisende";
const TIMEOUT_MS = 120_000;

export type GravAuthor = { key: string; name: string };
export type GravPost = {
  route: string;
  title: string;
  date: string | null;
  published: boolean;
};
export type GravMedia = { filename: string };

export function gravConfig() {
  const url = (process.env.GRAV_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.GRAV_API_KEY ?? "").trim();
  if (!url || !apiKey) return null;
  return { url, apiKey, insecureTls: process.env.GRAV_INSECURE_TLS === "1" };
}

function requireConfig() {
  const config = gravConfig();
  if (!config) {
    throw new HttpError(503, "Webseite nicht eingerichtet (GRAV_URL / GRAV_API_KEY).");
  }
  return config;
}

function apiPath(path: string) {
  return `/api/v1${path}`;
}

/** `/tagebuch/2026-10-24-barcelona` → `tagebuch/2026-10-24-barcelona`, each segment encoded. */
function routeParam(route: string) {
  return route.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

type GravResponse = { status: number; body: unknown };

function send(
  method: string,
  path: string,
  init: {
    json?: unknown;
    multipart?: { buffer: Buffer; boundary: string };
    /** Site path outside the API, e.g. `/route.json`. */
    raw?: boolean;
  } = {},
): Promise<GravResponse> {
  const config = requireConfig();
  const target = new URL(init.raw ? path : apiPath(path), config.url);
  const headers: Record<string, string> = {
    "X-API-Key": config.apiKey,
    Accept: "application/json",
  };
  let payload: Buffer | undefined;
  if (init.json !== undefined) {
    payload = Buffer.from(JSON.stringify(init.json));
    headers["Content-Type"] = "application/json";
  } else if (init.multipart) {
    payload = init.multipart.buffer;
    headers["Content-Type"] = `multipart/form-data; boundary=${init.multipart.boundary}`;
  }
  if (payload) headers["Content-Length"] = String(payload.length);

  const doRequest = target.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = doRequest(
      target,
      {
        method,
        headers,
        timeout: TIMEOUT_MS,
        ...(target.protocol === "https:" && config.insecureTls
          ? { rejectUnauthorized: false }
          : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: unknown = null;
          try {
            body = text ? JSON.parse(text) : null;
          } catch {
            body = text;
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Zeitüberschreitung")));
    req.on("error", (err) => {
      const code = (err as NodeJS.ErrnoException).code ?? "";
      const tls = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code);
      reject(
        new HttpError(
          502,
          tls
            ? "Webseite hat kein gültiges TLS-Zertifikat (GRAV_INSECURE_TLS=1 erlaubt es trotzdem)."
            : `Webseite nicht erreichbar: ${err.message}`,
        ),
      );
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function problem(res: GravResponse, what: string): HttpError {
  if (res.status === 401 || res.status === 403) {
    return new HttpError(
      502,
      "Webseite lehnt den API-Schlüssel ab (braucht api.pages.write und api.media.write).",
    );
  }
  const body = res.body as { detail?: string; title?: string } | null;
  const detail = body?.detail || body?.title || `HTTP ${res.status}`;
  return new HttpError(502, `${what}: ${detail}`);
}

async function call<T>(
  what: string,
  method: string,
  path: string,
  init?: Parameters<typeof send>[2],
): Promise<T> {
  const res = await send(method, path, init);
  if (res.status < 200 || res.status >= 300) throw problem(res, what);
  return ((res.body as { data?: T } | null)?.data ?? null) as T;
}

type RawPage = {
  route: string;
  title: string;
  date: string | null;
  published: boolean;
  template?: string;
  header?: Record<string, unknown>;
};

export async function getGravPage(route: string): Promise<RawPage | null> {
  const res = await send("GET", `/pages/${routeParam(route)}`);
  if (res.status === 404) return null;
  if (res.status < 200 || res.status >= 300) throw problem(res, "Seite lesen");
  return (res.body as { data: RawPage }).data;
}

export async function listGravAuthors(): Promise<GravAuthor[]> {
  const page = await getGravPage(GRAV_PEOPLE_ROUTE);
  const people = Array.isArray(page?.header?.personen) ? page.header.personen : [];
  return people
    .map((person: { schluessel?: unknown; name?: unknown }) => ({
      key: String(person.schluessel ?? "").trim(),
      name: String(person.name ?? person.schluessel ?? "").trim(),
    }))
    .filter((person) => person.key);
}

/** Trip chapters from the site's public `/route.json`; empty while the site has none. */
export async function listGravChapters(): Promise<SiteChapter[]> {
  const res = await send("GET", "/route.json", { raw: true });
  if (res.status !== 200) return [];
  const list = (res.body as { abschnitte?: unknown } | null)?.abschnitte;
  return Array.isArray(list) ? list.filter(isSiteChapter) : [];
}

export async function listGravPosts(): Promise<GravPost[]> {
  const params = new URLSearchParams({
    children_of: GRAV_DIARY_ROUTE,
    template: "beitrag",
    sort: "date",
    order: "desc",
    per_page: "100",
  });
  const pages = await call<RawPage[]>("Beiträge lesen", "GET", `/pages?${params}`);
  return (pages ?? []).map((page) => ({
    route: page.route,
    title: page.title,
    date: page.date,
    published: page.published,
  }));
}

export async function createGravPost(input: {
  route: string;
  title: string;
  content: string;
  header: Record<string, unknown>;
}) {
  return call<RawPage>("Beitrag anlegen", "POST", "/pages", {
    json: {
      route: input.route,
      title: input.title,
      template: "beitrag",
      content: input.content,
      header: input.header,
    },
  });
}

export async function updateGravHeader(route: string, header: Record<string, unknown>) {
  return call<RawPage>("Beitrag aktualisieren", "PATCH", `/pages/${routeParam(route)}`, {
    json: { header },
  });
}

export async function listGravMedia(route: string): Promise<GravMedia[]> {
  const media = await call<GravMedia[]>(
    "Fotos lesen",
    "GET",
    `/pages/${routeParam(route)}/media`,
  );
  return media ?? [];
}

/** Uploads one file; an existing file with the same name is overwritten by Grav. */
export async function uploadGravMedia(
  route: string,
  file: { filename: string; mime: string; data: Buffer },
) {
  const boundary = `----photobuddy${randomBytes(12).toString("hex")}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  await call("Foto hochladen", "POST", `/pages/${routeParam(route)}/media`, {
    multipart: { buffer: Buffer.concat([head, file.data, tail]), boundary },
  });
}

export async function saveGravMediaMeta(
  route: string,
  filename: string,
  fields: Record<string, string>,
) {
  await call(
    "Bildtext speichern",
    "PATCH",
    `/pages/${routeParam(route)}/media/${encodeURIComponent(filename)}/meta`,
    { json: { fields } },
  );
}

/** Same rules as the site theme's slug(): umlauts spelled out, other accents dropped. */
export function gravSlug(text: string) {
  const slug = text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 40).replace(/-+$/, "");
}
