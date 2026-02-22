# Architecture Overview

## Frontend
- React SPA with role-aware workspace panels
- Cookie-based session auth with automatic refresh retry on protected 401s
- Dashboard includes campaigns, matches, proposals, and invitation workflows

## Backend
- Express API with route modules and centralized error middleware
- Validation boundary with Zod schemas
- Security stack: Helmet, auth rate limiting, structured request logs
- Session lifecycle:
  - short-lived access token in httpOnly cookie
  - rotating refresh token in httpOnly cookie
  - refresh-token reuse detection revokes active sessions

## Observability and Operations
- `GET /live`: process liveness
- `GET /ready`: DB readiness check
- `GET /health`: compatibility health endpoint
- Audit logs persisted in `AuditLog` for auth and business-critical actions

## Route Modules
- `routes/auth.js`: signup/login/refresh/logout/me with cookie sessions
- `routes/campaigns.js`: campaign list/create/close with audit events
- `routes/matches.js`: brand-to-influencer matching with audit events
- `routes/proposals.js`: proposal creation and status transitions with audit events
- `routes/users.js`: influencer discovery for brands

## Data Model
- User, Campaign, Match, Proposal, RefreshToken, AuditLog
- Ownership checks enforced in route layer per user role

## CI
- GitHub Actions workflow (`.github/workflows/ci.yml`)
- Runs dependency install, Prisma generate/migrate, backend integration tests, and frontend build
