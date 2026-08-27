#!/bin/sh
# 4 Teilnehmer anlegen. Braucht curl und laufende App (Port 3388) oder .env + Postgres.
set -eu
root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

email="${1:-}"
password="${2:-}"
name="${3:-}"
color="${4:-}"

if [ -z "$email" ] || [ -z "$password" ]; then
  echo "Usage: $0 email password [Anzeigename] [Akzentfarbe]" >&2
  echo "Beispiel: $0 anna@familie.de geheim Anna" >&2
  exit 1
fi

if [ -f "$root/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  . "$root/.env"
  set +a
fi

base="${NEXT_PUBLIC_SITE_URL:-http://localhost:3388}"
base="${base%/}"
if [ -z "${AUTH_SECRET:-}" ]; then
  echo "AUTH_SECRET fehlt. Erst npm run setup oder einmal docker compose up -d." >&2
  exit 1
fi

name="${name:-${email%%@*}}"
body="{\"email\":\"$email\",\"password\":\"$password\",\"display_name\":\"$name\""
if [ -n "$color" ]; then
  body="$body,\"accent_color\":\"$color\""
fi
body="$body}"

curl -sS -X POST "$base/api/admin/users" \
  -H "Authorization: Bearer $AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d "$body"
echo
