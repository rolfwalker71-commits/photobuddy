#!/bin/sh
# 4 Teilnehmer anlegen. Braucht curl und laufendes Kong (Port 8000).
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
if [ -f "$root/supabase/generated/keys.env" ]; then
  # shellcheck disable=SC1091
  set -a
  . "$root/supabase/generated/keys.env"
  set +a
fi

base="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:8000}"
base="${base%/}"
if [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "SERVICE_ROLE_KEY fehlt. Erst npm run setup oder einmal docker compose up -d." >&2
  exit 1
fi

name="${name:-${email%%@*}}"
body="{\"email\":\"$email\",\"password\":\"$password\",\"email_confirm\":true,\"user_metadata\":{\"display_name\":\"$name\""
if [ -n "$color" ]; then
  body="$body,\"accent_color\":\"$color\""
fi
body="$body}}"

curl -sS -X POST "$base/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "$body"
echo
