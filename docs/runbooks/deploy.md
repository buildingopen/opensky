# Deploy Runbook

## Preconditions

- `main` branch is green in CI
- Required env vars are present in deployment platform
- No active incident preventing deploy

## Web (Vercel)

Connect the repo to Vercel for auto-deploy on push:

1. [Import the repo](https://vercel.com/new) → select `opensky-app` (or your fork).
2. Set **Root Directory** to `web` (or use the committed `vercel.json`).
3. Add env vars: `NEXT_PUBLIC_API_URL` (prod API URL), optionally `NEXT_PUBLIC_GA_MEASUREMENT_ID` or `NEXT_PUBLIC_POSTHOG_KEY`.
4. Deploy. Subsequent pushes to `main` auto-deploy.

## API (Render)

Deploys from `render.yaml`. Push to `main` triggers Render if the repo is connected. Configure `render.yaml` as the deploy source in Render Dashboard.

## Steps

1. Merge approved PR to `main`.
2. Confirm build starts on hosting provider (Vercel for web, Render for API).
3. Verify deploy completes successfully.
4. Run smoke checks:
   - `GET /api/healthz` returns `200`
   - `GET /api/readyz` returns `200`
5. Run one end-to-end search in production UI.

## Post-deploy verification

- Confirm search success rate is normal.
- Confirm outbound click events are flowing in analytics.
- Confirm error rates and latency are within SLO.
