# FlyFast Issues

## OPEN

### 3. Safety zone CTA: zone data NOT updated via cron
- **Status**: OPEN
- **Date**: 2026-03-19
- **Description**: Zone data last updated 2026-03-01 (18 days old). Zone alert worker must be run manually. No cron job set up.
- **Files**: `api/zone_alert_worker.py`

### 4. Preview API service missing on Hetzner
- **Status**: OPEN
- **Date**: 2026-03-19
- **Description**: `opensky-api-preview.service` does not exist on Hetzner. MEMORY.md references it on port 8091 but it was never created. Both preview.flyfast.app and flyfast.app use the same production API. No staging environment for API changes.
- **Fix**: Create preview API container/service on port 8091 with separate DNS

## FIXED

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
- **Description**: Changed broken `/?q=flights avoiding {zone}` (unparseable, no origin/dates) to `/?q=safe+routes` which pre-fills the search with "safe routes" qualifier. Updated CTA text to "Search safe flights" (`searchSafe` key) in all 12 locales.
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
