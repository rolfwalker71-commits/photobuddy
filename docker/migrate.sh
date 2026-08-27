#!/bin/sh
set -eu

export PGHOST="${PGHOST:-db}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

echo "migrate: waiting for Postgres..."
i=0
until psql -c "select 1" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "migrate: Postgres not reachable" >&2
    exit 1
  fi
  sleep 2
done

echo "migrate: waiting for auth.users and storage.buckets..."
i=0
while true; do
  auth_ok="$(psql -tAc "select 1 from information_schema.tables where table_schema='auth' and table_name='users'" || true)"
  storage_ok="$(psql -tAc "select 1 from information_schema.tables where table_schema='storage' and table_name='buckets'" || true)"
  if [ "$auth_ok" = "1" ] && [ "$storage_ok" = "1" ]; then
    break
  fi
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "migrate: auth/storage schemas not ready" >&2
    exit 1
  fi
  sleep 2
done

if [ "$(psql -tAc "select 1 from information_schema.tables where table_schema='public' and table_name='profiles'")" = "1" ]; then
  echo "migrate: Photobuddy schema already applied."
  exit 0
fi

echo "migrate: applying supabase/migrations/00001_init.sql..."
psql -v ON_ERROR_STOP=1 -f /migration.sql
echo "migrate: done."
