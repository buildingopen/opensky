# FlyFast Issues

## OPEN

*No open issues.*

## FIXED

### Zone alert worker cron set up
- **Status**: FIXED
- **Date**: 2026-03-19
- **Description**: Fixed hardcoded paths in zone_alert_worker.py (removed sys.path.insert, changed snapshot path to /data/). Set up daily cron at 6am UTC via `docker exec opensky-api python3 zone_alert_worker.py`. Log: `/var/log/flyfast-zone-alerts.log`.

### Preview API service created on Hetzner
- **Status**: FIXED
- **Date**: 2026-03-19
- **Description**: Created `opensky-api-preview` Docker container on Hetzner at port 8091. Set up nginx, DNS (api-preview.flyfast.app), and SSL. Separate staging environment for API changes.
- **URL**: https://api-preview.flyfast.app
- **Deploy path**: `/opt/flyfast-preview/` on Hetzner

### Duplicate highlights now supported (all date matches)
- **Status**: FIXED
- **Date**: 2026-03-19
- **Description**: "05 April to 15 April" now highlights both dates. Rewrote `detectDate()` to `detectDates()` returning all non-overlapping matches using global regex search. Locations already handled by `scanLocations()`.
- **Files**: `web/app/[locale]/SearchPage.tsx`

### Legal pages: verified correctly translated
- **Status**: NOT A BUG
- **Date**: 2026-03-19
- **Description**: Verified all 12 locale files have properly translated privacy, terms, contact content. Imprint is intentionally in German (legal requirement, TMG §5). No German leakage in non-German locales.

### Safety zone CTA fixed
- **Status**: FIXED
- **Date**: 2026-03-19
- **Description**: Changed broken `/?q=flights avoiding {zone}` (unparseable, no origin/dates) to `href="/"` (home page). Initial fix used `/?q=safe+routes` but that auto-triggered a failing search. Updated CTA text to "Search safe flights" (`searchSafe` key) in all 12 locales. Removed dead `searchAvoiding` key.
- **Files**: `web/app/[locale]/safety/[zone]/page.tsx`, `web/messages/*.json`

### Logo redesigned with split-arrow mark
- **Status**: FIXED
- **Date**: 2026-03-16
- **Description**: Replaced generic arrow/bolt with split-arrow logomark (two angular wing parallelograms with negative space gap). Updated header, favicon, 404 page, OG image.
- **Commit**: 85e8741

### CSP blocks PostHog and Google Analytics
- **Status**: FIXED
- **Date**: 2026-03-16
- **Description**: Content-Security-Policy headers in next.config.ts didn't include PostHog or GTM domains. Also PostHog was pointing to US endpoint (app.posthog.com) but account is EU.
- **Fix**: Added domains to script-src and connect-src. Changed PostHog host to eu.i.posthog.com.
