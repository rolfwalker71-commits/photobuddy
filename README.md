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

### Push für die iOS-App (APNs)

Die native iOS-App meldet ihr Gerät über `POST /api/push/apns` an (`{token, environment, albumId?, notifyMode?}`, Abmelden mit `DELETE`). Photobuddy sendet dann dieselben Benachrichtigungen wie per Web-Push (sofort bei neuem Foto, abends die Zusammenfassung) direkt an Apple — ohne zusätzliche Abhängigkeiten.

In `.env` (oder `/secrets/keys.env`) setzen: `APNS_KEY_ID`, `APNS_TEAM_ID` und den Schlüssel als `APNS_KEY_P8` (Inhalt der `.p8`-Datei, Zeilenumbrüche als `\n` erlaubt) oder `APNS_KEY_PATH`. `APNS_TOPIC` ist standardmässig `ch.rolfwalker.photobuddy`. Ohne diese Werte bleibt APNs still aus. Ungültige Geräte-Tokens (410 / `BadDeviceToken`) werden automatisch gelöscht.

### KI-Funktionen (OpenAI)

Für die iOS-App: `POST /api/ai/describe` (Titel, Beschreibung, Tags zu einem Foto), `/api/ai/search` (Fotosuche im Album) und `/api/ai/recap` (Reisegeschichte) und `/api/ai/report`. Der Schlüssel bleibt auf dem Server: `OPENAI_API_KEY` setzen, optional `OPENAI_MODEL` (Standard `gpt-4.1-mini`). Ohne Schlüssel antworten die Routen mit 503. Pro Person sind 30 Anfragen in 10 Minuten erlaubt.

`POST /api/ai/report` entwirft einen kurzen Reisebericht für die Homepage (danach editierbar und über `/api/publish` veröffentlichbar). Body: `{albumId, photoIds: [1–30 IDs], title?, language?: "de"}`. Aus Aufnahmedatum, Ortsname und Bildinhalt (die ersten 12 Fotos als Vorschaubild, der Rest nur mit Metadaten; Videos werden übersprungen) entsteht `{title (≤80), intro (≤300), text (≤1500, 2–4 Absätze), photos: [{id, caption (≤140)}]}`, sortiert nach Aufnahmedatum. Fehler: 400 (Eingabe), 401/403/404, 422 (kein verwendbares Foto), 429, 502 (KI-Fehler), 503 (kein Schlüssel).

### Neues Design & KI

Das Aussehen folgt der iOS-App: Indigo (`#5B66F5`) mit Koralle (`#FF6B66`) als Verlaufspartner, dazu eine Farbe pro Bereich (Galerie Indigo, Karte Türkis, Timeline Orange, Kamera Pink, Mehr Violett). Die Farben stehen als CSS-Variablen in `src/app/globals.css` (`--section-*`); Dock-Icons, aktive Markierung und der sanfte Farbverlauf am Seitenanfang nutzen sie. Die Galerie beginnt mit einer Album-Karte (Zeitraum, Zahlen, Mitglieder), die Karte zeigt Tageskarten zum Filtern, und leere Ansichten haben kleine Illustrationen. Unter Einstellungen → Hilfe ist alles kurz erklärt.

Mit gesetztem `OPENAI_API_KEY` (siehe oben) bietet die Web-App dieselben KI-Funktionen wie die iOS-App:

- **Foto:** «KI-Vorschlag» liefert Titel, Beschreibung und Tags; «Übernehmen» speichert sie.
- **Galerie:** Das Suchfeld filtert beim Tippen sofort nach Titel, Beschreibung, Ort und Tags. Enter (ab 3 Zeichen) startet die KI-Suche; der Chip «KI-Suche: … · N Treffer» lässt sich wieder entfernen.
- **Rückblick:** «Reisebericht schreiben» erzeugt einen Text zum Kopieren oder Teilen.

Fehlt der Schlüssel, zeigt die Oberfläche die Meldung des Servers und bleibt sonst unverändert. Die App-Icons erzeugt `scripts/generate-icons.mjs` beim Build.

### Offline hochladen

Fotos werden auf dem Gerät zwischengespeichert und gehen automatisch hoch, sobald wieder Netz da ist — auch nach einem Neustart der App. Die Warteschlange steht auf der Kamera-Seite.

### Widgets auf dem Homescreen

**Einstellungen → Widgets** erzeugt ein Skript für [Scriptable](https://scriptable.app) (gratis im App Store). Kopieren, in Scriptable als neues Skript einsetzen, auf dem Homescreen ein Scriptable-Widget anlegen und dort das Skript wählen.

| Widget | Grössen | Zeigt |
| --- | --- | --- |
| Letztes Foto | klein, mittel, gross | Neueste Aufnahme vollflächig, mit Ort, Zeit und Wetter |
| Collage | mittel, gross, iPad | Die 4 / 9 / 12 neuesten Aufnahmen |
| Reise-Status | klein, mittel | Tag der Reise, Aufnahmen heute, Ort, wer fotografiert |
| Route | mittel, gross, iPad | Der Weg aus den Foto-Standorten, selbst gezeichnet |
| Sperrbildschirm | rund, rechteckig, inline | Anzahl heute bzw. Ort und Zeit der letzten Aufnahme |

Album, Titel, Erscheinungsbild und was eingeblendet wird (Ort, Person, Wetter, nur Highlights) stellst du in der App ein — das Widget übernimmt es bei der nächsten Aktualisierung, das Skript muss nicht neu kopiert werden. Mockups aller Grössen: [`docs/widgets/`](docs/widgets).

Im Skript steckt ein persönlicher, nur lesender Link. Nicht weitergeben — und falls doch, in der App **Neuer Link** tippen: alle bisher kopierten Skripte hören dann auf zu funktionieren.

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

In der Galerie oben **Auf die Webseite hochladen** → Fotos antippen → **Weiter**. Im Dialog das Reise-Kapitel wählen (vorausgewählt nach Aufnahmezeit, Liste aus `/route.json` der Webseite) und ob ein Blogeintrag entsteht. Ohne Blogeintrag landen die Fotos auf der Seite **Fotos** (`/fotos`), mit Blogeintrag in einem neuen Tagebuch-Beitrag (`/tagebuch/<datum>-<ort>`, standardmässig Entwurf) oder einem bestehenden. Titel und Beschreibung werden zu `bildtext` und `alt`, dazu `abschnitt` (Kapitel) und `datum` (Aufnahmezeit, Ortszeit). Schon übertragene Fotos werden übersprungen. Videos bleiben in Photobuddy.

In `.env` (der Schlüssel bleibt auf dem Server, nie im Browser):

```bash
GRAV_URL=https://ferien2026.rolfwalker.ch
GRAV_API_KEY=grav_…
```

Schlüssel auf dem Grav-Server erzeugen: `bin/plugin api keys:generate -u rolf -N photobuddy` (Konto mit `api.pages.write` und `api.media.write`). Ohne diese Variablen erscheint der Button nicht.
