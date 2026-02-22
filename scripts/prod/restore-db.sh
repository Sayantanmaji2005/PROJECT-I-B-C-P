#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: ./scripts/prod/restore-db.sh <backup.sql.gz>"
  exit 1
fi

if [[ ! -f .env.prod ]]; then
  echo ".env.prod not found. Copy .env.prod.example and set values first."
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

source .env.prod

gunzip -c "${BACKUP_FILE}" | docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

echo "Restore completed from ${BACKUP_FILE}"
