#!/bin/sh
# Load POSTGRES_PASSWORD and AUTH_SECRET from the shared volume, then exec.
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

export POSTGRES_PASSWORD
export AUTH_SECRET
export PGPASSWORD="${POSTGRES_PASSWORD}"

exec "$@"
