# Photobuddy

Reise-Tagebuch als PWA für vier Personen. Teilnehmer:innen laden Fotos hoch; Familie sieht Raster, Karte und Timeline über einen Gast-Link — ohne Login.

## Schnellstart

Kein zweites Backend, keine lokale Postgres, kein `supabase start`. Nur ein [Supabase](https://supabase.com)-Projekt (Auth + DB + Storage).

1. **Projekt anlegen** auf [supabase.com](https://supabase.com).
2. **SQL einmal einfügen:** SQL Editor → Inhalt von `supabase/migrations/00001_init.sql` → Run. (Speichert den `gast_link_key` aus dem Ergebnis, oder hol ihn später in der App unter Einstellungen.)
3. **Auth-URLs:** Authentication → URL Configuration  
   Site URL `http://localhost:3388` · Redirects `http://localhost:3388/**` und `http://localhost:3388/auth/callback`
4. **4 Nutzer:** Authentication → Users → Add user (E-Mail + Passwort).
5. **`.env`:** `npm run setup` — dann nur URL und anon key aus Project Settings → API eintragen. `NEXT_PUBLIC_SITE_URL` ist schon `http://localhost:3388`.
6. **Start:** `npm install && npm run dev` → [http://localhost:3388](http://localhost:3388)

Das war’s für Tag 1.

### Was du überspringen kannst

Docker, GHCR, `supabase start`, lokale Datenbank, VAPID-Keys, `seed.sql`, Storage manuell anlegen, öffentliche Registrierung (kannst du später unter Auth abschalten), Magic-Link-Provider extra anschalten (E-Mail ist meist schon an).

Was **nicht** automatisiert werden kann: Supabase-Projekt, SQL einmal einfügen, 4 Nutzer, Auth-Redirects, `.env` ausfüllen.

### Server (gleicher Supabase)

`NEXT_PUBLIC_SITE_URL` = öffentliche URL (ohne Slash). Dieselbe URL plus `/auth/callback` bei den Auth-Redirects ergänzen.

Das Image `ghcr.io/rolfwalker71-commits/photobuddy` existiert **erst nach einem Commit + Push auf `main`** (GitHub Action). Dann auf dem Host:

```bash
docker compose pull && docker compose up -d
```

Port **3388**. Nie `--build` auf dem Server — Compose zieht nur GHCR, ohne lokales Dockerfile.

---

**Stack:** Next.js, Tailwind, Supabase (Auth, Postgres + RLS, Storage). Deploy: Docker-Image via GitHub Actions → GHCR (`linux/amd64`).

| | Teilnehmer | Gäste (Share-Link) |
| --- | --- | --- |
| Raster / Karte / Timeline | ja | ja |
| Fotos hochladen, bearbeiten, löschen | ja | nein |
| Kommentare & Emoji | ja | ja |

Lokales Image bauen (nur deine Maschine, nicht der Server): `docker compose -f docker-compose.yml -f docker-compose.build.yml build`
