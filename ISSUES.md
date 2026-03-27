# FlyFast Issues

## OPEN

### Search filters not discoverable
- **Status**: WONTFIX (product decision)
- **Date**: 2026-03-26
- **Source**: Yash (beta tester)
- **Description**: User says "I don't see filters like non-stop." NL parsing already supports "nonstop", "direct", "business class". Structured form exists behind toggle. Not worth adding more UI hints for marginal gain; NL parsing IS the feature.

## FIXED

### Differentiator not visible (combination breakdown surfaced)
- **Status**: FIXED
- **Date**: 2026-03-28
- **Source**: Yash (beta tester)
- **Description**: Multi-combination search was invisible. Moved combination breakdown from buried inline pill to standalone prominent line in ParsedConfig: "Searching 3 origins x 2 destinations x 4 dates = 24 combinations". Translated across all 12 locales.
- **Commit**: ffd4563

### Cursor misaligned in search input (green highlights removed)
- **Status**: FIXED
- **Date**: 2026-03-26
- **Source**: Yash (beta tester), screenshot confirmed
- **Description**: Text cursor appeared detached from visible text in search textarea. Root cause: highlight overlay used `text-base` (16px) while textarea used `text-lg` (18px), causing cumulative width drift. Also, user reported green highlights "not important." Removed the real-time highlight overlay entirely. Highlight functions preserved in SearchPage.tsx for future reactivation (still used by form pre-fill logic).
- **Commit**: 75d7f8d

## FIXED

### Canonical URLs wrong for all sub-pages
- **Status**: FIXED
- **Date**: 2026-03-20
- **Description**: All pages inherited homepage canonical from layout (`/${locale}`). Each page now sets its own canonical URL. Also fixed OG URLs on safety zone pages to include locale prefix, and ItemList schema URLs on safety index.
- **Commit**: afe189d

### Alert workers crash in Docker (wrong import paths)
- **Status**: FIXED
- **Date**: 2026-03-20
- **Description**: Both `alert_worker.py` and `zone_alert_worker.py` imported from `opensky.*` but Docker image installs `skyroute.*`. Changed to `skyroute.*` imports matching `main.py`. Also fixed `alert_worker.py` default DB path and removed unused `sys`/`time` imports. Redeployed to Hetzner, verified imports work inside container.
- **Commit**: afe189d

### Dead SearchPage.tsx removed (3163 lines)
- **Status**: FIXED
- **Date**: 2026-03-20
- **Description**: `web/app/SearchPage.tsx` was a pre-i18n copy only imported by one stale test. Removed both files. The live page is `web/app/[locale]/SearchPage.tsx`.
- **Commit**: afe189d

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
