# OpenSky App

Hosted application for natural-language flight search with conflict-zone-aware routing.

## Architecture

- `web/`: Next.js frontend (search UX, result rendering, sharing, SEO surface)
- `api/`: FastAPI backend (prompt parsing, provider search orchestration, safety filtering)
- `render.yaml`: Render deployment definition for API service
- `vercel.json`: Vercel config (root `web/`) for auto-deploy on push

## Quick Start

### 1) Frontend

```bash
cd web
cp .env.example .env.local
npm ci
npm run dev
```

### 2) Backend

```bash
cd api
cp .env.example .env
python3 -m venv .venv
.venv/bin/pip install "git+https://github.com/buildingopen/opensky.git@eb315fb6498404db84aa85ed1757bd79f05a9f62"
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000
```

## Analytics

Set either `NEXT_PUBLIC_GA_MEASUREMENT_ID` (GA4) or `NEXT_PUBLIC_POSTHOG_KEY` (PostHog) in `.env.local` to enable event tracking. Events are sent to the configured provider via `web/lib/analytics.ts`.

**Event taxonomy:**

| Event | Properties | When |
|-------|------------|------|
| `search_submitted` | `prompt_length`, `mode`, `ref`, `utm_source` | User submits a search |
| `search_results_received` | `count`, `has_return` | Results stream completes |
| `search_error` | `stage`, `status_code`/`detail`/`type` | Search fails |
| `rate_limit_hit` | `ref` | 429 from API |
| `outbound_click` | `provider`, `route`, `ref`, `utm_source` | User clicks Book or Compare |
| `results_shared` | `has_web_share` | User shares results |
| `example_prompt_clicked` | `prompt` | User clicks an example |
| `new_search_clicked` | `previous_results` | User starts a new search |

## API Keys (optional)

For trusted clients (internal tools, partners), you can set `API_KEYS` (comma-separated) and `API_KEY_QUOTA` (e.g. 100/hour). Requests with a valid `X-API-Key` or `Authorization: Bearer <key>` header use the higher quota instead of the default IP-based limit.

## Quality Gates

- Frontend: `npm run lint && npm run typecheck && npm run test:run && npm run build`
- Backend: `REQUIRE_GEMINI_KEY=false .venv/bin/pytest -q`
- Smoke checks: `bash scripts/smoke-test.sh` (set `API_BASE_URL` if needed)

## Operations

- Health: `/api/healthz`
- Readiness: `/api/readyz`
- Runbooks: `docs/runbooks/`
- SLOs: `docs/slo.md`

## Staging

A staging API can be deployed from `render.staging.yaml` (e.g. `opensky-api-staging`). Set `STAGING_API_URL` as a GitHub repo secret to run smoke tests against staging on every push to `main`. See `docs/runbooks/rollback.md` for the rollback drill.

## Release Checklist

1. CI green on `main`
2. Smoke tests pass against deployed API
3. No open P0/P1 incidents
4. Changelog updated
5. Rollback commit identified
