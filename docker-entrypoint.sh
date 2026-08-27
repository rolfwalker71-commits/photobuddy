#!/bin/sh
set -eu

if [ -f /secrets/keys.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /secrets/keys.env
  set +a
fi

VAPID_DIR="${VAPID_DIR:-/data/vapid}"
mkdir -p "$VAPID_DIR"

if [ -z "${NEXT_PUBLIC_VAPID_PUBLIC_KEY:-}" ] || [ -z "${VAPID_PRIVATE_KEY:-}" ]; then
  if [ ! -f "$VAPID_DIR/keys.json" ]; then
    echo "Generating VAPID keys for push notifications..."
    web-push generate-vapid-keys --json > "$VAPID_DIR/keys.json"
  fi
  NEXT_PUBLIC_VAPID_PUBLIC_KEY="$(node -e "const k=require('${VAPID_DIR}/keys.json'); process.stdout.write(k.publicKey || k.public || '')")"
  VAPID_PRIVATE_KEY="$(node -e "const k=require('${VAPID_DIR}/keys.json'); process.stdout.write(k.privateKey || k.private || '')")"
  export NEXT_PUBLIC_VAPID_PUBLIC_KEY
  export VAPID_PRIVATE_KEY
fi

export VAPID_SUBJECT="${VAPID_SUBJECT:-mailto:photobuddy@localhost}"

SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3388}"
SITE_URL="${SITE_URL%/}"
export NEXT_PUBLIC_SITE_URL="${SITE_URL}"

placeholder_url() {
  [ -z "${1:-}" ] && return 0
  [ "$1" = "https://xxxx.supabase.co" ] && return 0
  [ "$1" = "https://placeholder.supabase.co" ] && return 0
  return 1
}

if placeholder_url "${NEXT_PUBLIC_SUPABASE_URL:-}"; then
  proto="${SITE_URL%%://*}"
  rest="${SITE_URL#*://}"
  host="${rest%%/*}"
  host="${host%%:*}"
  NEXT_PUBLIC_SUPABASE_URL="${proto}://${host}:${KONG_HTTP_PORT:-8000}"
fi
export NEXT_PUBLIC_SUPABASE_URL

export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${ANON_KEY:-}}"

PUBLIC_DIR="/app/public"
mkdir -p "$PUBLIC_DIR"

# Runtime public env so one GHCR image works with different hosts.
# Never write service_role into this file.
node <<'NODE'
const fs = require("fs");
const path = "/app/public/runtime-config.js";
const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
};
const body =
  "window.__PHOTOBUDDY_ENV__ = " + JSON.stringify(env) + ";\n";
fs.writeFileSync(path, body);
NODE

if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs "$VAPID_DIR" "$PUBLIC_DIR/runtime-config.js" || true
  exec su-exec nextjs "$@"
fi

exec "$@"
