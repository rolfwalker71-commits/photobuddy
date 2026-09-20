# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Photobuddy is a travel-diary PWA for a handful of participants ("Teilnehmer") who upload photos/short videos into albums; family views grid, map, timeline and recap through a guest share link without logging in. Next.js 15 (App Router, React 19), Tailwind 3, PostgreSQL via raw `pg`, files on a Docker volume. All UI text, error messages, and README are **German with Swiss spelling** (`grösser`, not `größer`) — keep new strings consistent.

## Commands

```bash
npm run setup                 # writes .env with AUTH_SECRET, POSTGRES_PASSWORD, ADMIN_PASSWORD, DATABASE_URL
docker compose -f docker-compose.yml -f docker-compose.host-db.yml up -d db   # Postgres on localhost:5433 for local dev
npm run dev                   # Next.js on :3388
npm run lint                  # next lint (next/core-web-vitals + next/typescript)
npm run typecheck             # tsc --noEmit
npm test                      # vitest run (src/**/*.test.ts); single file: npx vitest run src/lib/route.test.ts
npm run build                 # prebuild generates PWA icons, then next build (standalone output)
npm run create-user -- anna@familie.de geheim Anna   # create a Teilnehmer without the UI
docker compose up -d          # full stack from the GHCR image (app on :3388, db only on the compose network)
docker compose -f docker-compose.yml -f docker-compose.build.yml build   # build the image locally
```

Tests are pure-logic and access-control unit tests (vitest, node env, `@/` alias in `vitest.config.ts`); DB and `next/headers` are mocked with `vi.mock` (see `src/lib/auth/request.test.ts`). `.github/workflows/ci.yml` runs lint, typecheck and tests on push/PR.

Backups: `scripts/backup.sh` (cron, pulls `/api/admin/backup` with `Bearer $AUTH_SECRET`) and `scripts/restore-backup.sh <zip>` (Docker stack; needs docker, curl, unzip on the host).

## Deployment constraints

- `docker-compose.yml` must stay image-only (`ghcr.io/rolfwalker71-commits/photobuddy`) — never add `build:` there; local builds go through the `docker-compose.build.yml` overlay. The image is built by `.github/workflows/docker-publish.yml` on push to `main` (linux/amd64 only).
- Postgres is deliberately not published on host port 5432; the dev overlay uses 5433.
- One image serves any host: `docker-entrypoint.sh` writes `public/runtime-config.js` (`window.__PHOTOBUDDY_ENV__`) at container start and generates VAPID keys if missing. Client code must read public env via `getPublicEnv()` / `getSiteUrl()` in `src/lib/env.ts`, not `process.env.NEXT_PUBLIC_*` directly, or the build-time placeholder leaks into production.

## Architecture

### Database and migrations
- `src/lib/db/pool.ts` exposes `query` / `queryOne`; every call first awaits `ensureMigrated()`, so migrations in `db/migrations/*.sql` apply lazily on the first query (tracked in `schema_migrations`, sorted by filename). Add schema changes as a new numbered `000NN_*.sql` file — never edit an applied one.
- Migrations must be idempotent-safe SQL: backups (`src/lib/backup.ts`) restore with explicit column lists into the same or a newer schema, so new NOT NULL columns need defaults.
- The migrate step also bootstraps the admin user from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (`src/lib/db/bootstrap.ts`) and purges trashed photos older than 30 days (soft delete via `photos.deleted_at`).
- `scripts/migrate.mjs` duplicates the migration runner for the Node CLI scripts (they can't import the TS code); keep the two in sync.
- All SQL lives in `src/lib/db/queries.ts`; row→API-type mapping is in `src/lib/db/mappers.ts`, shared types in `src/lib/types.ts`. The `supabase/` directory is a leftover from a previous Supabase-based stack and is unused.

### Auth and access model
- Sessions are a custom HMAC-signed cookie (`photobuddy_session`, `src/lib/auth/session.ts`, Web Crypto so it runs in middleware); passwords use scrypt (`src/lib/auth/password.ts`).
- `src/middleware.ts` → `src/lib/auth/middleware.ts` only redirects page routes to `/login`; it does **not** protect `/api/*`. Every API route must do its own check with helpers from `src/lib/auth/request.ts`:
  - `requireTeilnehmer` / `requireAdmin` — logged-in user / admin role.
  - `requireViewer` — returns either a Teilnehmer or a guest resolved from a share key (`?key=` or the `photobuddy_share` cookie), each guest key bound to one album.
  - `assertCanAccessAlbum`, `requirePhotoAccess`, `requirePhotoEditor`, `requireEditor` — album membership (admins bypass), guests read/comment/react only.
  - Route handlers wrap their body in `try { … } catch (err) { return jsonError(err); }` and throw `HttpError(status, message)`.
- Guests are identified for comments/reactions by a client-generated session id and display name stored in localStorage + cookie (`src/lib/guest.ts`).

### Two viewer modes, one UI
- Teilnehmer pages (`/gallery`, `/map`, `/timeline`, `/photos/[id]`, `/recap`) and guest pages (`/gallery/share/...`) render the same components with `mode="teilnehmer" | "guest"` and a `shareKey` — e.g. `TripView`, via `GuestTripPage` for guests. Build links with `appHref()` (`src/lib/paths.ts`) and API URLs with `withKey()` / `withParams()` (`src/lib/api.ts`) so the share key and `albumId` propagate.
- `useTripData` (`src/hooks/use-trip-data.ts`) loads everything for the current album from `/api/trip`, then polls `/api/photos/updated` every 10s for a change stamp and reloads silently when it differs. After client-side mutations call `notifyPhotosChanged()` (`src/lib/photos-sync.ts`) so other views refresh.

### Media pipeline
- Client (`src/lib/image.ts`, `upload-form.tsx`) reads EXIF/GPS with `exifr` and compresses to a full JPEG plus a thumbnail with `browser-image-compression`; videos are capped at ~15 s / 40 MB, photos at 15 MB.
- Uploads never post directly: the form compresses, then `enqueueUpload()` (`src/lib/upload-queue.ts`) stores the ready files in IndexedDB. A single runner (Web Lock across tabs) sends them via XHR with progress, backs off on network errors, and survives reloads/offline starts. `UploadQueueIndicator` (mounted in `providers.tsx`) and `UploadQueuePanel` (camera page) read it via `useUploadQueue`. Each item's id is sent as `clientUploadId`; the server returns the existing photo for a repeated id (`photos.client_upload_id`), so retries are idempotent.
- `POST /api/photos` hashes content for duplicate detection per album (409 unless `keepDuplicate=1`), writes files under `PHOTOS_DIR/<userId>/` (thumbs in `thumbs/`), fetches archive weather, inserts the row, and sends web push (`src/lib/push.ts`).
- Instant pushes skip subscriptions with `notify_mode = 'daily'`; those get one evening summary per album from `runDailyDigest()` (`src/lib/digest.ts`), started by `src/instrumentation.ts` (5-min timer; `push_digests` rows claim each album/day once). Hour and time zone are app settings (`digest_hour`, `digest_time_zone`).
- Files are served only through `/api/photos/files/[...path]`; always resolve disk paths with `resolvePhotoPath()` (`src/lib/files.ts`), which blocks path traversal. Use `previewPhotoUrl()` for grid/map/timeline and the full `storage_path` for detail views (`src/lib/storage.ts`).
- Geocoding goes through Nominatim (`src/lib/nominatim.ts`, `/api/geocode/*`).

### Maps
- Leaflet via react-leaflet; map components are loaded through `*-dynamic.tsx` wrappers (`next/dynamic`, no SSR) — add new map components the same way.
- Basemaps are free, key-less tile providers defined in `src/lib/map-styles.ts` (`MAP_STYLE_IDS` + `MAP_STYLES`); the selected style is an app setting (`/api/settings`, `map_style`) read by `useMapStyle`. `/map-styles-preview` and `public/map-compare.html` preview them.

### Liquid Glass design system
- `src/app/globals.css` holds the whole material system. Three materials: `.glass-chrome` (header, dock, floating bars), `.glass-panel` / `bg-card` (content cards), `.glass-fill` (controls inside a panel). Over photos and maps use `.glass-over-media`, on a black stage `.glass-over-dark`, behind sheets `.glass-scrim`.
- Existing markup keeps saying `bg-card` / `bg-muted` / `ring-border` / `shadow-card`: those tokens are redefined as glass (utility overrides in `globals.css`, shadow tokens in `tailwind.config.ts`), so a material change is one edit, not 200. `bg-card` deliberately sets no `box-shadow` — `shadow-card` owns the lit top edge and the shaded bottom edge, and one would silently overwrite the other.
- Glass needs something behind it: `body::before` paints a fixed ambient wash. Never give it a solid background.
- `prefers-reduced-transparency` and `prefers-contrast: more` collapse every material to opaque by swapping the CSS variables — no layout depends on translucency, so nothing shifts.
- `.app-shell` is every page's outer container: dock clearance and safe areas on phones, rail clearance from `lg` up. A `py-*` or `px-*` utility on the same element overrides it, so put padding on an inner element instead.
- `FloatingDock` renders twice from one item list: a bottom bar below `lg`, a left rail from `lg` (iPad). Both mark the current view with a lens that slides; its geometry is calculated against the bar's padding box, so changing the padding means changing the `lensWidth` calc.

### PWA
- `public/sw.js` is a hand-written service worker (bump `CACHE_NAME` when changing cached shell assets). It caches `/_next/static` cache-first and keeps `/camera`, `/gallery`, `/map`, `/timeline` network-first with an offline fallback, so photos can be queued without signal; `public/manifest.webmanifest`; icons are generated by `scripts/generate-icons.mjs` during `prebuild`. The middleware matcher excludes `sw.js`, `runtime-config.js`, icons and the manifest — keep new static PWA files excluded too.

### Homescreen widgets (Scriptable)
- `src/lib/widget/script.ts` generates the Scriptable script the Teilnehmer copies to their phone. The body lives in `String.raw` and must contain no backticks and no `${`, or the template would swallow them — hence string concatenation throughout. `npm test` guards this (`script.test.ts`).
- Only the address and a per-user token are baked in; everything else comes from `/api/widget/data?token=`. Settings changes therefore take effect on the next refresh without copying the script again.
- The token (`users.widget_token`, migration `00008`) stands in for a session because Scriptable keeps no cookies. Every endpoint that accepts it is read-only, and **Neuer Link** rotates it, invalidating every copied script. `/api/widget/photo/[id]` also accepts an ordinary session, so the settings page previews with the same image URLs.
- Three renderers draw the same layouts and must stay in step: the Scriptable script (the real one), `src/components/widget-preview.tsx` (the in-app preview), and the mockup generator that produced `docs/widgets/`. Shared, testable geometry lives in `src/lib/widget/geo.ts` — the script carries its own copy since it ships as one standalone file.
- Widget settings are validated server-side in `src/lib/widget/settings.ts` on read *and* write, so a stale page cannot store a layout the script cannot draw.
