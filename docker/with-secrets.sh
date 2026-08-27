#!/bin/sh
# Load JWT/Postgres secrets from the shared volume, then exec the real command.
set -eu

i=0
while [ ! -f /secrets/keys.env ]; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "with-secrets: /secrets/keys.env missing after 60s" >&2
    exit 1
  fi
  sleep 1
done

set -a
# shellcheck disable=SC1091
. /secrets/keys.env
set +a

export JWT_SECRET
export POSTGRES_PASSWORD
export ANON_KEY
export SERVICE_ROLE_KEY
export PGPASSWORD="${POSTGRES_PASSWORD}"
export JWT_EXP="${JWT_EXPIRY:-3600}"
export JWT_EXPIRY="${JWT_EXPIRY:-3600}"

export GOTRUE_JWT_SECRET="${JWT_SECRET}"
export GOTRUE_JWT_ISSUER="${GOTRUE_JWT_ISSUER:-supabase-photobuddy}"
export GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/postgres"

export PGRST_DB_URI="postgres://authenticator:${POSTGRES_PASSWORD}@db:5432/postgres"
export PGRST_JWT_SECRET="${JWT_SECRET}"
export PGRST_APP_SETTINGS_JWT_SECRET="${JWT_SECRET}"
export PGRST_APP_SETTINGS_JWT_EXP="${JWT_EXPIRY:-3600}"

export DATABASE_URL="postgres://supabase_storage_admin:${POSTGRES_PASSWORD}@db:5432/postgres"
export AUTH_JWT_SECRET="${JWT_SECRET}"
export SERVICE_KEY="${SERVICE_ROLE_KEY}"

SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3388}"
SITE_URL="${SITE_URL%/}"
export NEXT_PUBLIC_SITE_URL="${SITE_URL}"
export GOTRUE_SITE_URL="${SITE_URL}"

if [ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
  proto="${SITE_URL%%://*}"
  rest="${SITE_URL#*://}"
  host="${rest%%/*}"
  host="${host%%:*}"
  NEXT_PUBLIC_SUPABASE_URL="${proto}://${host}:${KONG_HTTP_PORT:-8000}"
fi
export NEXT_PUBLIC_SUPABASE_URL
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${ANON_KEY}}"
export API_EXTERNAL_URL="${API_EXTERNAL_URL:-${NEXT_PUBLIC_SUPABASE_URL}/auth/v1}"
export STORAGE_PUBLIC_URL="${STORAGE_PUBLIC_URL:-${NEXT_PUBLIC_SUPABASE_URL}}"
export SUPABASE_PUBLIC_URL="${SUPABASE_PUBLIC_URL:-${NEXT_PUBLIC_SUPABASE_URL}}"

ALLOW="http://localhost:3388/**,http://localhost:3388/auth/callback,http://127.0.0.1:3388/**,http://127.0.0.1:3388/auth/callback,${SITE_URL}/**,${SITE_URL}/auth/callback"
if [ -n "${ADDITIONAL_REDIRECT_URLS:-}" ]; then
  ALLOW="${ALLOW},${ADDITIONAL_REDIRECT_URLS}"
fi
export GOTRUE_URI_ALLOW_LIST="${ALLOW}"

exec "$@"
