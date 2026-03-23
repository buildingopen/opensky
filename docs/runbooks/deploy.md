# Deploy Runbook

## Preconditions

- `main` branch is green in CI
- Required env vars are present in deployment platform
- No active incident preventing deploy

## Live Architecture

- Web runs on Vercel from this repo.
- API runs on Hetzner in Docker under `/opt/flyfast`.
- Preview API runs on Hetzner in Docker under `/opt/flyfast-preview`.
- Browser traffic should use same-origin Next.js route handlers. The browser should not call the Python API directly.

## Required Env Contract

### Web (Vercel)

- `NEXT_PUBLIC_API_URL=https://api.flyfast.app`
- `INTERNAL_API_BASE_URL=https://api.flyfast.app`
- `INTERNAL_API_TOKEN=<shared-secret>`
- `NEXT_PUBLIC_SITE_URL=https://flyfast.app`
- `NEXT_PUBLIC_POSTHOG_KEY=<optional>`

Preview should point to `https://api-preview.flyfast.app` with its own `INTERNAL_API_TOKEN`.

### API (Hetzner)

- `ENVIRONMENT=production`
- `ALLOW_RATE_LIMIT_FALLBACK=false`
- `PUBLIC_PARSE_ENABLED=false`
- `TRUST_PROXY=true`
- `TRUSTED_PROXY_IPS=127.0.0.1/32,172.18.0.1/32`
- `REDIS_URL=<redis-url>`
- `INTERNAL_API_TOKEN=<same shared-secret as matching web env>`
- Existing product secrets such as `GEMINI_API_KEY`, `RESEND_API_KEY`, `POSTHOG_API_KEY`

## Deploy Steps

### 1. Push code

1. Merge approved PR to `main`.
2. Confirm `origin/main` contains the intended commit.

### 2. Deploy web on Vercel

1. Confirm Vercel production envs are set correctly.
2. Deploy production:
   ```bash
   cd /root/opensky-app
   vercel deploy --prod --yes
   ```
3. Confirm the deployment is aliased to `https://flyfast.app`.

### 3. Deploy API on Hetzner

1. SSH to the server:
   ```bash
   ssh hetzner
   ```
2. Sync the updated API files into `/opt/flyfast/`.
3. Confirm `/opt/flyfast/.env` still contains the required production envs above.
4. Rebuild and restart:
   ```bash
   cd /opt/flyfast
   docker compose up -d --build --remove-orphans
   ```
5. Confirm the container is healthy:
   ```bash
   docker ps --filter name=opensky-api
   ```

### 4. Run smoke tests

1. API only:
   ```bash
   API_BASE_URL="https://api.flyfast.app" bash scripts/smoke-test.sh
   ```
2. Preview:
   ```bash
   API_BASE_URL="https://api-preview.flyfast.app" SITE_BASE_URL="https://preview.flyfast.app" bash scripts/smoke-test.sh
   ```

## Post-deploy Verification

- `GET /api/readyz` returns `200` and reports Redis connected.
- Direct unauthenticated `POST /api/search` on the API host returns `403`.
- `POST https://flyfast.app/api/search` streams results successfully.
- One manual production search succeeds in the UI.
- Error rates, readiness, and Redis health stay normal after deploy.
