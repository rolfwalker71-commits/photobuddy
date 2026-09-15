# Photobuddy

Reise-Tagebuch als PWA für vier Personen. Teilnehmer:innen laden Fotos hoch; Familie sieht Raster, Karte und Timeline über einen Gast-Link — ohne Login.

## Schnellstart

Alles läuft lokal in Docker: Photobuddy (Port **3388**) plus PostgreSQL. Kein Cloud-Konto.

1. **`.env`:** `npm run setup` — legt Secrets und das Admin-Passwort an. Lokal sind die URLs schon richtig.
2. **Stack:** `docker compose up -d` → [http://localhost:3388](http://localhost:3388)
3. **Anmelden** als Admin (`ADMIN_EMAIL`, Passwort steht in `.env` als `ADMIN_PASSWORD`).
4. **Teilnehmer** unter **Einstellungen → Teilnehmer** anlegen.

Login ist E-Mail + Passwort. Gäste nutzen nur den Share-Link.

Handy im WLAN: in `.env` die App-URL auf die LAN-IP setzen, dann Compose neu starten:

```bash
NEXT_PUBLIC_SITE_URL=http://192.168.1.10:3388
```

### Lokal entwickeln (Next.js auf dem Rechner)

Postgres in Docker, Next.js auf dem Rechner. Default-Compose veröffentlicht **keinen** Host-Port für Postgres (5432 ist oft schon belegt). Der App-Container spricht `db:5432` im Compose-Netz.

Volle Stack ohne Host-Postgres: `docker compose up -d`.

Nur Postgres + `npm run dev` — Overlay veröffentlicht **localhost:5433**:

```bash
npm run setup
docker compose -f docker-compose.yml -f docker-compose.host-db.yml up -d db
npm install && npm run dev
```

`DATABASE_URL` in `.env` dann `postgres://photobuddy:…@127.0.0.1:5433/photobuddy` (`npm run setup` schreibt das so).

Optional, ohne UI: `npm run create-user -- anna@familie.de geheim Anna`

### Was du überspringen kannst

Cloud-Dashboard, Storage-Bucket, VAPID von Hand. Schema, Admin-Konto und Gäste-Link kommen mit dem ersten Start.

### Benachrichtigungen

Push pro Gerät: „Bei jedem Foto“ oder „Abends“ — eine Zusammenfassung pro Album („Heute 23 neue Aufnahmen von Anna und Ben · Altdorf“). Gäste bekommen standardmässig die Abend-Variante. Uhrzeit und Zeitzone: **Einstellungen → Tägliche Zusammenfassung** (Admin).

### Offline hochladen

Fotos werden auf dem Gerät zwischengespeichert und gehen automatisch hoch, sobald wieder Netz da ist — auch nach einem Neustart der App. Die Warteschlange steht auf der Kamera-Seite.

### Server (gleicher Compose-Stack)

`NEXT_PUBLIC_SITE_URL` = öffentliche App-URL (ohne Slash).

```bash
docker compose pull && docker compose up -d
```

Nur Port **3388**. Postgres bleibt im Compose-Netz (`db:5432`), nicht auf dem Host. Nie `--build` auf dem Server — Compose zieht das GHCR-Image, ohne lokales Dockerfile.

Das Image `ghcr.io/rolfwalker71-commits/photobuddy` existiert **erst nach einem Commit + Push auf `main`** (GitHub Action).

Fotos liegen im Volume **`photobuddy-photos`**, die Datenbank in **`photobuddy-db`**, Secrets in **`photobuddy-secrets`**, VAPID in **`photobuddy-vapid`**.

Wenn zuvor das alte Supabase-Stack lief: Volume `photobuddy-db` einmal löschen (`docker volume rm photobuddy-db`), das Format ist nicht kompatibel.

### Backup

**Einstellungen → Backup** lädt ein ZIP mit Datenbank, Fotos und Push-Schlüsseln. Automatisch jede Nacht (Server, im Photobuddy-Ordner):

```bash
30 3 * * * cd /pfad/zu/photobuddy && scripts/backup.sh backups 14 >> backups/backup.log 2>&1
```

Wiederherstellen (ersetzt alle Daten, braucht `docker`, `curl`, `unzip`):

```bash
scripts/restore-backup.sh backups/photobuddy-backup-2026-09-11_0330.zip
```

Lokales Image bauen (nur deine Maschine, nicht der Server): `docker compose -f docker-compose.yml -f docker-compose.build.yml build`

---

**Stack:** Next.js, Tailwind, PostgreSQL, Dateien auf einem Docker-Volume. Deploy: Docker-Image via GitHub Actions → GHCR (`linux/amd64`).

| | Teilnehmer | Gäste (Share-Link) |
| --- | --- | --- |
| Raster / Karte / Timeline | ja | ja |
| Fotos hochladen, bearbeiten, löschen | ja | nein |
| Kommentare & Emoji | ja | ja |
| Teilnehmer verwalten | nur Admin | nein |

## Fotos auf die Webseite (Grav)

In der Galerie Fotos auswählen → **Auf die Webseite**. Photobuddy legt über die API der Grav-Seite einen Tagebuch-Beitrag an (`/tagebuch/<datum>-<ort>`, standardmässig als Entwurf) oder hängt die Fotos an einen bestehenden Beitrag. Bildtitel und Beschreibung werden zu `bildtext` und `alt`; die Seite **Fotos** sammelt die Bilder automatisch. Schon übertragene Fotos werden übersprungen. Videos bleiben in Photobuddy.

In `.env` (der Schlüssel bleibt auf dem Server, nie im Browser):

```bash
GRAV_URL=https://ferien2026.rolfwalker.ch
GRAV_API_KEY=grav_…
```

Schlüssel auf dem Grav-Server erzeugen: `bin/plugin api keys:generate -u rolf -N photobuddy` (Konto mit `api.pages.write` und `api.media.write`). Ohne diese Variablen erscheint der Button nicht.
