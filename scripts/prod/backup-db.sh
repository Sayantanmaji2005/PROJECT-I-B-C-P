#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env.prod ]]; then
  echo ".env.prod not found. Copy .env.prod.example and set values first."
  exit 1
fi

source .env.prod

mkdir -p backups
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="backups/${POSTGRES_DB}_${STAMP}.sql.gz"

docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${OUT_FILE}"

echo "Backup saved: ${OUT_FILE}"
