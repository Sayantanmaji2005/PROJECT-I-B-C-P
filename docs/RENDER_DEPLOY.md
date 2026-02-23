# Render Cloud Deploy (Free-Tier Friendly)

This project includes a Render Blueprint file at `render.yaml` that creates:
- 1 Node web service (`ibcpapp-api`)
- 1 Static site (`ibcpapp-web`)

Use this when home-network hosting is blocked (CGNAT/router/ISP captive portal).

## 0. Database prerequisite
Render free tier allows only one active free PostgreSQL DB per workspace.

Use one of these:
- Existing Render PostgreSQL DB connection string, or
- External free PostgreSQL (Neon/Supabase/etc).

## 1. Push code to GitHub
From repo root:

```powershell
git add render.yaml docs/RENDER_DEPLOY.md frontend/package.json README.md
git commit -m "Add Render cloud deployment blueprint"
git push origin main
```

## 2. Create services on Render
1. Sign in at `https://dashboard.render.com` with GitHub.
2. Click `New +` -> `Blueprint`.
3. Select this repo (`PROJECT-I-B-C-P`).
4. Render will detect `render.yaml` and show 2 resources.
5. Click `Apply`.

## 3. Wait for first deploy
Render will provision:
- API web service
- Frontend static site

Open `ibcpapp-web` service and copy its URL:
- Format: `https://<something>.onrender.com`

## 4. Set required environment variables
1. In service `ibcpapp-api` -> `Environment`:
   - `DATABASE_URL=postgresql://...` (your real DB connection string)

Then redeploy `ibcpapp-api` once.

## 5. Set exact CORS/API URLs (important)
If Render changed generated hostnames from defaults, update:

1. In service `ibcpapp-api` -> `Environment`:
   - `CORS_ORIGIN=https://<your-frontend-url>`
2. In service `ibcpapp-web` -> `Environment`:
   - `VITE_API_BASE=https://<your-api-url>`
3. Redeploy both services after edits.

## 6. Verify
1. API health:
   - `https://<your-api-url>/ready`
2. Web app:
   - `https://<your-frontend-url>`
3. Login with seeded admin:
   - Email: `admin@gmail.com`
   - Password: `ChangeMe123!`

After first login, change admin credentials in-app.

## 7. Notes
- `COOKIE_SECURE=true` and `TRUST_PROXY=true` are already configured in Blueprint.
- `COOKIE_DOMAIN` is intentionally blank so cookies stay host-scoped.
- Free plans can sleep after inactivity; first request can be slow.
