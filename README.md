# Photobuddy

Reise-Tagebuch als PWA für vier Personen. Teilnehmer:innen laden Fotos hoch; Familie sieht Raster, Karte und Timeline über einen Gast-Link — ohne Login.

## Schnellstart

Alles läuft lokal in Docker: Photobuddy (Port **3388**) plus PostgreSQL. Kein Cloud-Konto.

1. **`.env`:** `npm run setup` — legt Secrets an. Lokal sind die URLs schon richtig.
2. **Stack:** `docker compose up -d` → [http://localhost:3388](http://localhost:3388)
3. **4 Nutzer** (ohne Dashboard):
   ```bash
   npm run create-user -- anna@familie.de geheim Anna
   npm run create-user -- sam@familie.de geheim Sam
   npm run create-user -- kim@familie.de geheim Kim
   npm run create-user -- leo@familie.de geheim Leo
   ```
   Auf dem Server ohne Node: `./scripts/create-teilnehmer.sh anna@familie.de geheim Anna`

Login ist E-Mail + Passwort.

Handy im WLAN: in `.env` die App-URL auf die LAN-IP setzen, dann Compose neu starten:

```bash
NEXT_PUBLIC_SITE_URL=http://192.168.1.10:3388
```

### Lokal entwickeln (Next.js auf dem Rechner)

Postgres muss in Docker laufen, die App nicht:

```bash
npm run setup
docker compose up -d db
npm install && npm run dev
```

### Was du überspringen kannst

Cloud-Dashboard, Storage-Bucket, VAPID von Hand. Schema und Gäste-Link kommen mit dem ersten Start.

### Server (gleicher Compose-Stack)

`NEXT_PUBLIC_SITE_URL` = öffentliche App-URL (ohne Slash).

```bash
docker compose pull && docker compose up -d
```

Nur Port **3388**. Nie `--build` auf dem Server — Compose zieht das GHCR-Image, ohne lokales Dockerfile.

Das Image `ghcr.io/rolfwalker71-commits/photobuddy` existiert **erst nach einem Commit + Push auf `main`** (GitHub Action).

Fotos liegen im Volume **`photobuddy-photos`**, die Datenbank in **`photobuddy-db`**, Secrets in **`photobuddy-secrets`**, VAPID in **`photobuddy-vapid`**.

Wenn zuvor das alte Supabase-Stack lief: Volume `photobuddy-db` einmal löschen (`docker volume rm photobuddy-db`), das Format ist nicht kompatibel.

Lokales Image bauen (nur deine Maschine, nicht der Server): `docker compose -f docker-compose.yml -f docker-compose.build.yml build`

---

**Stack:** Next.js, Tailwind, PostgreSQL, Dateien auf einem Docker-Volume. Deploy: Docker-Image via GitHub Actions → GHCR (`linux/amd64`).

| | Teilnehmer | Gäste (Share-Link) |
| --- | --- | --- |
| Raster / Karte / Timeline | ja | ja |
| Fotos hochladen, bearbeiten, löschen | ja | nein |
| Kommentare & Emoji | ja | ja |
