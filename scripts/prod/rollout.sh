#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env.prod ]]; then
  echo ".env.prod not found. Copy .env.prod.example and set values first."
  exit 1
fi

echo "1/5 Running pre-deploy checks"
npm run ci:check

echo "2/5 Creating database backup"
bash ./scripts/prod/backup-db.sh

echo "3/5 Deploying containers"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "4/5 Running production migrations"
npm run deploy:migrate

source .env.prod
echo "5/5 Validating readiness endpoint"
for i in {1..20}; do
  if curl -fsS "https://${APP_DOMAIN}/ready" >/dev/null; then
    echo "Rollout successful"
    exit 0
  fi
  sleep 3
done

echo "Rollout failed: readiness check did not pass"
exit 1
