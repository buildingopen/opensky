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

### Hetzner (API)

1. SSH to the API host:
   ```bash
   ssh hetzner
   ```
2. Go to the production API directory:
   ```bash
   cd /opt/flyfast
   ```
3. List backups and pick the last known good snapshot:
   ```bash
   ls -1dt backups/*
   ```
4. Restore the desired snapshot:
   ```bash
   backup="backups/<timestamp>"
   cp "${backup}"/main.py .
   cp "${backup}"/alert_worker.py .
   cp "${backup}"/zone_alert_worker.py .
   cp "${backup}"/Dockerfile .
   cp "${backup}"/requirements.txt .
   cp "${backup}"/docker-compose.yml .
   cp "${backup}"/.env .
   ```
5. Rebuild and restart:
   ```bash
   docker compose up -d --build --remove-orphans
   ```
6. Run smoke checks:
   ```bash
   API_BASE_URL="https://api.flyfast.app" bash scripts/smoke-test.sh
   ```

### Vercel (Web)

1. Open [Vercel Dashboard](https://vercel.com) → select the FlyFast web project.
2. Go to **Deployments**.
3. Find the last known good deployment (check commit and status).
4. Click **⋮** → **Promote to Production** (or **Redeploy** if needed).
5. Wait for the deployment to finish.
6. Verify the site loads and search works.

---

## Rollback drill

Run this drill at least once per release cycle to ensure the rollback path works.

### Prerequisites

- Preview API deployed on Hetzner at `https://api-preview.flyfast.app`.
- Preview web environment points to the preview API via `INTERNAL_API_BASE_URL`.

### Drill steps

1. **Baseline**: Run smoke checks against staging.
   ```bash
   API_BASE_URL="https://api-preview.flyfast.app" SITE_BASE_URL="https://preview.flyfast.app" bash scripts/smoke-test.sh
   ```
   Expect: all checks pass.

2. **Simulate bad deploy**: Deploy a known-bad API change to preview or restore a broken backup snapshot.

3. **Verify failure**: Re-run smoke checks. Expect: at least one check fails.

4. **Rollback**: Restore the previous preview snapshot under `/opt/flyfast-preview/backups` and restart the preview container.

5. **Re-verify**: After rollback completes, run smoke checks again.
   ```bash
   API_BASE_URL="https://api-preview.flyfast.app" SITE_BASE_URL="https://preview.flyfast.app" bash scripts/smoke-test.sh
   ```
   Expect: all checks pass.

6. **Document**: Add a row to the drill log below.

---

## Rollback drill log

| Date       | Environment | Outcome | Notes                         |
|------------|-------------|---------|-------------------------------|
| 2026-03-12 | staging     | Pass    | Initial drill per Push to 10 |
