# FlyFast Issues

## OPEN

### Logo needs professional redesign
- **Status**: OPEN (agent iterating)
- **Date**: 2026-03-16
- **Description**: Current logomark is a simple arrow/bolt SVG that looks generic. Needs a distinctive, memorable mark that evokes speed + flight without being a literal airplane. Should feel like a brand studio designed it.
- **Files**: SiteHeader.tsx (desktop + mobile), favicon.svg, not-found.tsx, og/route.tsx
- **Note**: Background agent spawned to iterate on designs. Review output and pick best candidate.

## FIXED

### CSP blocks PostHog and Google Analytics
- **Status**: FIXED
- **Date**: 2026-03-16
- **Description**: Content-Security-Policy headers in next.config.ts didn't include PostHog or GTM domains. Also PostHog was pointing to US endpoint (app.posthog.com) but account is EU.
- **Fix**: Added domains to script-src and connect-src. Changed PostHog host to eu.i.posthog.com.
