#!/usr/bin/env bash
# Backup (Einstellungen → Backup oder scripts/backup.sh) in den Docker-Stack
# einspielen. Ersetzt ALLE Daten. Im Photobuddy-Ordner neben docker-compose.yml:
#
#   scripts/restore-backup.sh photobuddy-backup-2026-09-11_0330.zip
#
# Braucht docker, curl und unzip auf dem Host.
set -euo pipefail
cd "$(dirname "$0")/.."

zip="${1:-}"
if [ -z "$zip" ] || [ ! -f "$zip" ]; then
  echo "Aufruf: scripts/restore-backup.sh <backup.zip>" >&2
  exit 1
fi
for tool in docker curl unzip; do
  command -v "$tool" >/dev/null 2>&1 || { echo "$tool fehlt." >&2; exit 1; }
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
unzip -q "$zip" -d "$tmp"
if [ ! -f "$tmp/database.sql" ]; then
  echo "Kein database.sql im Backup — ist das ein Photobuddy-Backup?" >&2
  exit 1
fi
cat "$tmp/manifest.json" 2>/dev/null || true
echo

read -r -p "Alle aktuellen Photobuddy-Daten werden ersetzt. Weiter? [j/N] " answer
[ "$answer" = "j" ] || [ "$answer" = "J" ] || { echo "Abgebrochen."; exit 1; }

port="$(grep -E '^PORT=' .env 2>/dev/null | tail -n 1 | cut -d= -f2-)"
port="${port:-3388}"

echo "1/4 Stack starten, Schema auf den aktuellen Stand bringen…"
docker compose up -d
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:${port}/api/settings" >/dev/null 2>&1 && break
  sleep 2
done

echo "2/4 App anhalten, Datenbank einspielen…"
docker compose stop photobuddy
docker compose exec -T db psql -q -v ON_ERROR_STOP=1 -U photobuddy -d photobuddy < "$tmp/database.sql"

if [ -d "$tmp/photos" ]; then
  echo "3/4 Fotos zurückkopieren…"
  docker run --rm -v photobuddy-photos:/data -v "$tmp/photos":/src:ro alpine \
    sh -c 'find /data -mindepth 1 -delete && cp -a /src/. /data/'
else
  echo "3/4 Backup ohne Fotos — vorhandene Dateien bleiben."
fi

if [ -f "$tmp/vapid/keys.json" ]; then
  docker run --rm -v photobuddy-vapid:/data -v "$tmp/vapid":/src:ro alpine \
    cp /src/keys.json /data/keys.json
fi

echo "4/4 App starten…"
docker compose start photobuddy
echo "Fertig."
