# Production Runbook

This runbook closes the operational gaps for cloud launch.

## 1. Prerequisites
- DNS `A`/`AAAA` record for `APP_DOMAIN` pointing to your server.
- Ports `80` and `443` open to the internet.
- Docker + Docker Compose installed.
- `backend/.env.prod` created from `backend/.env.prod.example`.
- `.env.prod` created from `.env.prod.example`.

## 2. First-time deploy
1. `cp .env.prod.example .env.prod`
2. `cp backend/.env.prod.example backend/.env.prod`
3. Update secrets and domain values.
4. `npm run deploy:up`
5. `npm run deploy:migrate`
6. Verify:
   - `https://<APP_DOMAIN>/live`
   - `https://<APP_DOMAIN>/ready`
   - `https://<APP_DOMAIN>/health`

## 3. HTTPS/domain verification
- Caddy terminates TLS automatically for `APP_DOMAIN` via `Caddyfile`.
- Validate certificate:
  - `curl -Iv https://<APP_DOMAIN>`
- Ensure backend cookies use secure settings:
  - `COOKIE_SECURE=true`
  - `TRUST_PROXY=true`
  - `CORS_ORIGIN` matches deployed frontend URL.

## 4. Database migrations on live DB
- Run only deploy migrations in production:
  - `npm run deploy:migrate`
- This uses `prisma migrate deploy` and is safe for CI/CD pipelines.

## 5. Monitoring, logs, alerts
- App logs:
  - `npm run deploy:logs`
  - Backend emits JSON logs when `LOG_FORMAT="json"`.
- Uptime monitoring:
  - Start with monitoring profile:
    - `docker compose -f docker-compose.prod.yml --env-file .env.prod --profile monitoring up -d`
  - Open Uptime Kuma at `http://<server-ip>:3001`.
  - Add checks for `/live`, `/ready`, `/health`.
  - Configure alert integrations (email/Slack/Telegram) in Kuma notifications.

## 6. Backup and recovery
- Backup:
  - `npm run db:backup`
  - Output is stored in `backups/*.sql.gz`
- Restore:
  - `npm run db:restore -- backups/<file>.sql.gz`
- Policy:
  - Daily backup + off-server copy.
  - Keep at least 7 daily + 4 weekly snapshots.

## 7. Rollout strategy
- Safe rollout command:
  - `bash ./scripts/prod/rollout.sh`
- What it does:
  - Runs tests/build (`ci:check`)
  - Takes DB backup
  - Rebuilds/restarts prod stack
  - Runs live migrations
  - Verifies readiness endpoint

## 8. Rollback strategy
1. `npm run deploy:down`
2. Re-deploy previous image/tag.
3. Restore DB if migration/data issue:
   - `npm run db:restore -- backups/<known-good>.sql.gz`
4. Confirm `/ready` before reopening traffic.
