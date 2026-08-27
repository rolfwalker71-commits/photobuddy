# Photobuddy

Reise-Tagebuch als PWA für vier Personen. Teilnehmer:innen laden Fotos hoch; Familie sieht Raster, Karte und Timeline über einen Gast-Link — ohne Login.

## Schnellstart

Alles läuft lokal in Docker: Photobuddy (Port **3388**) plus selbst gehostetes Supabase (Kong/API auf Port **8000**). Kein Konto auf supabase.com.

1. **`.env`:** `npm run setup` — legt Secrets an. Lokal sind die URLs schon richtig.
2. **Stack:** `docker compose up -d` → [http://localhost:3388](http://localhost:3388)
3. **4 Nutzer** (ohne Dashboard; Profil entsteht automatisch):
   ```bash
   npm run create-user -- anna@familie.de geheim Anna
   npm run create-user -- sam@familie.de geheim Sam
   npm run create-user -- kim@familie.de geheim Kim
   npm run create-user -- leo@familie.de geheim Leo
   ```
   Auf dem Server ohne Node: `./scripts/create-teilnehmer.sh anna@familie.de geheim Anna`

Login ist E-Mail + Passwort. Magic Link braucht einen SMTP-Server (in Compose nicht eingerichtet).

Handy im WLAN: in `.env` beide URLs auf die LAN-IP setzen, dann Compose neu starten:

```bash
NEXT_PUBLIC_SITE_URL=http://192.168.1.10:3388
NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.10:8000
```

### Lokal entwickeln (Next.js auf dem Rechner)

Supabase muss in Docker laufen, die App nicht:

```bash
npm run setup
npm run supabase:up
npm install && npm run dev
```

### Was du überspringen kannst

supabase.com, SQL Editor, Auth-URLs im Dashboard, Storage-Bucket anlegen, VAPID von Hand. Schema, Bucket `photos` und Gäste-Link kommen mit dem ersten Start.

### Server (gleicher Compose-Stack)

`NEXT_PUBLIC_SITE_URL` = öffentliche App-URL (ohne Slash).  
`NEXT_PUBLIC_SUPABASE_URL` = dieselbe Hostadresse mit Port **8000** (Kong), oder die URL deines Reverse-Proxys zur API.

```bash
docker compose pull && docker compose up -d
```

Port **3388** (App) und **8000** (Supabase-API). Nie `--build` auf dem Server — Compose zieht das GHCR-Image, ohne lokales Dockerfile.

Das Image `ghcr.io/rolfwalker71-commits/photobuddy` existiert **erst nach einem Commit + Push auf `main`** (GitHub Action).

Fotos liegen im Volume **`photobuddy-storage`**, die Datenbank in **`photobuddy-db`**, JWT-Keys in **`photobuddy-secrets`**, VAPID in **`photobuddy-vapid`**.

Lokales Image bauen (nur deine Maschine, nicht der Server): `docker compose -f docker-compose.yml -f docker-compose.build.yml build`

---

**Stack:** Next.js, Tailwind, selbst gehostetes Supabase (Auth/GoTrue, Postgres + RLS, Storage, Kong). Deploy: Docker-Image via GitHub Actions → GHCR (`linux/amd64`).

| | Teilnehmer | Gäste (Share-Link) |
| --- | --- | --- |
| Raster / Karte / Timeline | ja | ja |
| Fotos hochladen, bearbeiten, löschen | ja | nein |
| Kommentare & Emoji | ja | ja |
