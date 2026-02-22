# Influencer & Brand Collaboration Platform

Production-ready full-stack platform starter for influencer-brand collaboration workflows.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL (Docker Compose for dev + test)

## Production Pass Included
- Cookie-based auth sessions (`httpOnly`, `sameSite`, optional `secure`)
- Rotating refresh tokens with replay/reuse detection
- Audit logging for auth + campaign + match + proposal actions
- Security middleware (`helmet`), auth rate limits, and request logging
- Readiness endpoints: `/live`, `/ready`, `/health`
- Integration tests (`vitest` + `supertest`) updated for cookie auth
- GitHub Actions CI for migrate + test + frontend build

## Infra Commands (Root)
- `npm run infra:up` starts Docker PostgreSQL for dev and test
- `npm run infra:down` stops and removes containers
- `npm run infra:logs` tails DB logs

## Local App Setup
1. Start infra:
   - `npm run infra:up`
2. Configure backend env:
   - `Copy-Item backend/.env.example backend/.env`
3. Configure frontend env:
   - `Copy-Item frontend/.env.example frontend/.env`
4. Migrate + generate + seed:
   - `npm run db:migrate`
   - `npm run db:generate`
   - `npm run db:seed`
5. Start backend and frontend:
   - `npm run dev:backend`
   - `npm run dev:frontend`

## Backend Tests (Docker test DB)
1. Create test env:
   - `Copy-Item backend/.env.test.example backend/.env.test`
2. Run test DB migration:
   - `cd backend`
   - `npm run prisma:migrate:test -- --name test_init`
3. Run tests:
   - `npm run test`

## Cookie/Auth Env Notes
- `COOKIE_SECURE=true` for HTTPS production deployments
- `COOKIE_SAME_SITE=lax` by default (adjust for cross-site setups)
- `COOKIE_DOMAIN` optional for shared subdomain sessions
- `TRUST_PROXY=true` behind reverse proxies/load balancers
- `CORS_ORIGIN` supports comma-separated origins (e.g. app + admin hosts)

## Production Deploy Checklist
1. Backend
   - Set strong `JWT_SECRET`
   - Set `COOKIE_SECURE=true`
   - Set `TRUST_PROXY=true` behind load balancers/reverse proxies
   - Set `CORS_ORIGIN` to deployed frontend origin(s)
2. Frontend
   - Set `VITE_API_BASE` to your public backend base URL (leave blank for same-origin deployments)
3. Database
   - Set production `DATABASE_URL`
   - Run migrations in deploy pipeline
4. Pre-deploy verification
   - `npm run ci:check`
5. Runbook
   - `docs/PRODUCTION_RUNBOOK.md`

## Production Docker Deploy
1. `Copy-Item .env.prod.example .env.prod`
2. `Copy-Item backend/.env.prod.example backend/.env.prod`
3. Set your domain/secrets in both files.
4. `npm run deploy:up`
5. `npm run deploy:migrate`
6. Tail logs with `npm run deploy:logs`

## API Summary
- Auth: `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- Campaigns: `/api/campaigns`, `/api/campaigns/mine`, `/api/campaigns/:id/close`
- Matches: `/api/matches`
- Proposals: `/api/proposals`, `/api/proposals/:id/status`
- Users: `/api/users/influencers`
- Health: `/live`, `/ready`, `/health`
