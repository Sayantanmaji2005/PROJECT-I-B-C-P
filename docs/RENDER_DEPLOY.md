# Render Cloud Deploy (Free-Tier Friendly)

This project includes a Render Blueprint file at `render.yaml` that creates:
- 1 Node web service (`ibcpapp-api`)
- 1 Static site (`ibcpapp-web`)
- 1 PostgreSQL database (`ibcpapp-db`)

Use this when home-network hosting is blocked (CGNAT/router/ISP captive portal).

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
4. Render will detect `render.yaml` and show 3 resources.
5. Click `Apply`.

## 3. Wait for first deploy
Render will provision:
- Postgres DB
- API web service
- Frontend static site

Open `ibcpapp-web` service and copy its URL:
- Format: `https://<something>.onrender.com`

## 4. Set exact CORS/API URLs (important)
If Render changed generated hostnames from defaults, update:

1. In service `ibcpapp-api` -> `Environment`:
   - `CORS_ORIGIN=https://<your-frontend-url>`
2. In service `ibcpapp-web` -> `Environment`:
   - `VITE_API_BASE=https://<your-api-url>`
3. Redeploy both services after edits.

## 5. Verify
1. API health:
   - `https://<your-api-url>/ready`
2. Web app:
   - `https://<your-frontend-url>`
3. Login with seeded admin:
   - Email: `admin@gmail.com`
   - Password: `ChangeMe123!`

After first login, change admin credentials in-app.

## 6. Notes
- `COOKIE_SECURE=true` and `TRUST_PROXY=true` are already configured in Blueprint.
- `COOKIE_DOMAIN` is intentionally blank so cookies stay host-scoped.
- Free plans can sleep after inactivity; first request can be slow.
