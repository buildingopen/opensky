# Launch Readiness 100 Plan

## Scope
Repository: `buildingopen/opensky-app`  
Production site: `https://sky.buildingopen.org`  
Production API: `https://opensky-api.buildingopen.org`

## Goal
Reach a verified **100/100** launch readiness score with evidence captured on production.

## Required Evidence Checklist
- [ ] Production UI shows **Skyscanner + Compare prices** links on flight cards.
- [ ] Production prompt input expands for multi-line text.
- [ ] Booking link behavior is accurate or explicitly labeled as marketplace search.
- [ ] Production success flow screenshot captured.
- [ ] Production error flow screenshot captured.
- [ ] Mobile production success screenshot captured.
- [ ] Accessibility audit on production with no serious/critical issues.
- [ ] `npm audit --omit=dev` clean in app repo.
- [ ] `pip-audit` (or equivalent) clean for API dependencies.

## Plan
1. **Deploy app repo to production**
   - Deploy current `main` to production hosting.
   - Evidence: deployment logs saved and a production URL with updated UI.

2. **Verify production UI parity**
   - Run Playwright on `https://sky.buildingopen.org` and capture:
     - success results view
     - error view
     - mobile success view
     - multiline prompt view
   - Evidence paths:
     - `/tmp/opensky-app/.tmp/ux-prod-desktop-success.png`
     - `/tmp/opensky-app/.tmp/ux-prod-desktop-error.png`
     - `/tmp/opensky-app/.tmp/ux-prod-mobile-success.png`
     - `/tmp/opensky-app/.tmp/ux-prod-desktop-multiline.png`

3. **Resolve booking link mismatch**
   - Decision required:
     - Option A: Add provider-accurate booking URLs per provider.
     - Option B: Change CTA text to explicitly state a marketplace search (no exact match guarantee).
   - Evidence: updated production screenshot showing the new CTA or provider-accurate links.

4. **Accessibility audit on production**
   - Run axe (or equivalent) against production pages.
   - Evidence: saved report file (JSON or HTML).

5. **Security and dependency audits**
   - Web:
     - Run `npm audit --omit=dev` in `web/`.
     - Evidence: command output saved.
   - API:
     - Run `pip-audit` in the API environment.
     - Evidence: command output saved.

6. **Final UX verification**
   - Confirm prompt auto-resize in production with a real multiline entry.
   - Confirm both booking links appear on production results.
   - Evidence: production screenshots from Step 2.

## Exit Criteria
All checklist items are verified with production evidence and stored locally.

## Notes
- This plan targets production verification. Local or mock environments do not count for the 100/100 score.
- If rate limits or provider outages block verification, capture the error state and retry until a successful run is recorded.
