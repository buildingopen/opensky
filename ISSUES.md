# FlyFast Issues

## OPEN

(none)

## FIXED

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
