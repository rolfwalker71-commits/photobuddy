#!/bin/sh
set -eu

EXISTING_AUTH="${AUTH_SECRET:-}"
EXISTING_PG="${POSTGRES_PASSWORD:-}"

if [ -f /secrets/keys.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /secrets/keys.env
  set +a
fi

# .env / Compose gewinnt gegenüber einem alten secrets-Volume.
export AUTH_SECRET="${EXISTING_AUTH:-${AUTH_SECRET:-}}"
export POSTGRES_PASSWORD="${EXISTING_PG:-${POSTGRES_PASSWORD:-}}"
export PHOTOS_DIR="${PHOTOS_DIR:-/data/photos}"
mkdir -p "$PHOTOS_DIR"

if [ -z "${DATABASE_URL:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
  DATABASE_URL="postgres://photobuddy:${POSTGRES_PASSWORD}@db:5432/photobuddy"
fi
export DATABASE_URL="${DATABASE_URL:-}"

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

PUBLIC_DIR="/app/public"
mkdir -p "$PUBLIC_DIR"

# Runtime public env so one GHCR image works with different hosts.
node <<'NODE'
const fs = require("fs");
const path = "/app/public/runtime-config.js";
const env = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
};
const body =
  "window.__PHOTOBUDDY_ENV__ = " + JSON.stringify(env) + ";\n";
fs.writeFileSync(path, body);
NODE

if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs "$VAPID_DIR" "$PHOTOS_DIR" "$PUBLIC_DIR/runtime-config.js" || true
  exec su-exec nextjs "$@"
fi

exec "$@"
