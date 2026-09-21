#!/usr/bin/env bash
# Bring up Eucardia's own database and seed it.
#
#   ./scripts/db-up.sh
#
# Uses, in order of preference:
#   1. DATABASE_URL already in .env.local (e.g. a hosted Postgres)
#   2. a local Homebrew postgresql@17 service
#   3. Postgres in Docker on port 5433
#
# Safe to re-run — the seed truncates and re-inserts.
set -euo pipefail
cd "$(dirname "$0")/.."

BREW_PG="/opt/homebrew/opt/postgresql@17/bin"
[ -d "$BREW_PG" ] && PATH="$BREW_PG:$PATH"

if [ -f .env.local ] && grep -q '^DATABASE_URL=' .env.local; then
  set -a; . ./.env.local; set +a
  echo "Using DATABASE_URL from .env.local"

elif command -v pg_isready >/dev/null 2>&1 && pg_isready -q 2>/dev/null; then
  createdb eucardia 2>/dev/null || true
  export DATABASE_URL="postgres://$(whoami)@localhost:5432/eucardia"
  echo "Using local Homebrew Postgres"
  [ -f .env.local ] && printf '\n# Eucardia'"'"'s own system of record (local Homebrew Postgres).\nDATABASE_URL="%s"\n' "$DATABASE_URL" >> .env.local

elif docker info >/dev/null 2>&1; then
  CONTAINER=eucardia-pg
  if [ -z "$(docker ps -q -f name="^${CONTAINER}$")" ]; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    echo "Starting Postgres in Docker…"
    docker run -d --name "$CONTAINER" \
      -e POSTGRES_PASSWORD=eucardia -e POSTGRES_USER=eucardia -e POSTGRES_DB=eucardia \
      -p 5433:5432 postgres:17-alpine >/dev/null
    for _ in $(seq 1 60); do docker exec "$CONTAINER" pg_isready -U eucardia -q 2>/dev/null && break; sleep 1; done
  fi
  export DATABASE_URL="postgres://eucardia:eucardia@localhost:5433/eucardia"
  echo "Using Docker Postgres"
  [ -f .env.local ] && printf '\n# Eucardia'"'"'s own system of record (Docker Postgres).\nDATABASE_URL="%s"\n' "$DATABASE_URL" >> .env.local

else
  cat <<'MSG'
No Postgres available. Either:
  brew install postgresql@17 && brew services start postgresql@17
or start Docker Desktop, or set DATABASE_URL in .env.local to a hosted database.
MSG
  exit 1
fi

node db/seed.mjs
