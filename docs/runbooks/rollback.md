# Rollback Runbook

## Trigger conditions

- Error rate spikes above alert threshold
- Readiness probe fails persistently
- Critical user flow (search -> results -> outbound) is broken

## Steps

1. Identify last known good commit.
2. Redeploy previous stable release from hosting provider history.
3. Verify:
   - `/api/healthz` = 200
   - `/api/readyz` = 200
   - Search flow returns results
4. Announce rollback in incident channel.
5. Open follow-up issue with root cause and prevention task.

---

## Concrete provider steps

### Render (API)

1. Open [Render Dashboard](https://dashboard.render.com) → select **opensky-api**.
2. Go to **Deploys**.
3. Find the last known good deploy (check commit hash and status).
4. Click the **⋮** menu on that deploy → **Redeploy**.
5. Wait for the deploy to complete (green status).
6. Run smoke checks: `API_BASE_URL=https://opensky-api.onrender.com bash scripts/smoke-test.sh`

### Vercel (Web)

1. Open [Vercel Dashboard](https://vercel.com) → select the OpenSky project.
2. Go to **Deployments**.
3. Find the last known good deployment (check commit and status).
4. Click **⋮** → **Promote to Production** (or **Redeploy** if needed).
5. Wait for the deployment to finish.
6. Verify the site loads and search works.

---

## Rollback drill

Run this drill at least once per release cycle to ensure the rollback path works.

### Prerequisites

- Staging API deployed (e.g. from `render.staging.yaml` → `opensky-api-staging` on Render).
- `STAGING_API_URL` set (e.g. `https://opensky-api-staging.onrender.com`).
- Optional: Vercel preview deployments can point to staging by setting `NEXT_PUBLIC_API_URL` to the staging API URL in the Preview environment.

### Drill steps

1. **Baseline**: Run smoke checks against staging.
   ```bash
   API_BASE_URL="${STAGING_API_URL}" bash scripts/smoke-test.sh
   ```
   Expect: all checks pass.

2. **Simulate bad deploy**: Trigger a deploy with a known-bad change (e.g. temporarily break healthz), or use Render’s “Rollback” to an older deploy that was broken.

3. **Verify failure**: Re-run smoke checks. Expect: at least one check fails.

4. **Rollback**: In Render Dashboard → opensky-api-staging → Deploys → Redeploy previous (last known good).

5. **Re-verify**: After rollback completes, run smoke checks again.
   ```bash
   API_BASE_URL="${STAGING_API_URL}" bash scripts/smoke-test.sh
   ```
   Expect: all checks pass.

6. **Document**: Add a row to the drill log below.

---

## Rollback drill log

| Date       | Environment | Outcome | Notes                         |
|------------|-------------|---------|-------------------------------|
| 2026-03-12 | staging     | Pass    | Initial drill per Push to 10 |
