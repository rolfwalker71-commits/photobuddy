#!/usr/bin/env bash
# Backup von der laufenden App holen (Datenbank + Fotos + Push-Schlüssel).
# Im Photobuddy-Ordner neben docker-compose.yml und .env ausführen:
#
#   scripts/backup.sh [zielordner] [anzahl_behalten] [--nur-db]
#
# Täglich per cron, z. B. 03:30 Uhr, 14 Stück behalten:
#   30 3 * * * cd /pfad/zu/photobuddy && scripts/backup.sh backups 14 >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

dest="${1:-backups}"
keep="${2:-14}"
query=""
[ "${3:-}" = "--nur-db" ] && query="?photos=0"

env_value() {
  grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

secret="$(env_value AUTH_SECRET)"
port="$(env_value PORT)"
port="${port:-3388}"
if [ -z "$secret" ]; then
  echo "AUTH_SECRET fehlt in .env (npm run setup)." >&2
  exit 1
fi

mkdir -p "$dest"
file="$dest/photobuddy-backup-$(date +%Y-%m-%d_%H%M)${query:+-nur-db}.zip"
curl -fsS --max-time 3600 \
  -H "Authorization: Bearer $secret" \
  "http://127.0.0.1:${port}/api/admin/backup${query}" \
  -o "$file.part"
mv "$file.part" "$file"

if command -v unzip >/dev/null 2>&1 && ! unzip -tq "$file" >/dev/null 2>&1; then
  echo "Warnung: $file ist kein gültiges ZIP." >&2
  exit 1
fi

# Nur die neuesten $keep Backups behalten.
ls -1t "$dest"/photobuddy-backup-*.zip 2>/dev/null | tail -n +"$((keep + 1))" | while read -r old; do
  rm -f -- "$old"
done

echo "$(date '+%F %T') Backup gespeichert: $file ($(du -h "$file" | cut -f1))"
