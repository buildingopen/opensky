# Launch Readiness Revision 2

## Date
2026-03-13

## Scope
Repository: `buildingopen/opensky-app`  
Production site: `https://sky.buildingopen.org`  
Production API: `https://opensky-api.buildingopen.org`

## Current Verified Status
Current launch readiness: **7/10**  
Target launch readiness: **10/10**

## Items Closed Since Revision 1
- Production prompt input now expands for multi-line text.
- Production success flow works.
- Production error flow works.
- Production results-state accessibility check passed for the tested WCAG 2A/2AA scope.
- Web dependency audit is clean.

## Items Still Open
1. **Production deployment parity**
   - Production still shows the old `Compare prices` CTA.
   - Production does not yet show the newer Google Flights CTA from the app repo.
   - Verified on production:
     - desktop: `compareButtons: 12`, `googleLinks: 0`
     - mobile: `compareButtons: 12`, `googleLinks: 0`

2. **Booking-link integrity**
   - Production still routes non-provider bookings through a generic Skyscanner search URL.
   - Example verified on production:
     - query: `Delhi to Nairobi 21st March`
     - CTA text: `Compare prices`
     - URL: `https://www.skyscanner.net/transport/flights/del/nbo/260321/...`
   - This does not guarantee the exact displayed flight exists on the destination page.

3. **API dependency security**
   - `uvx pip-audit -r api/requirements.txt` still reports 2 Starlette CVEs:
     - `CVE-2025-54121`
     - `CVE-2025-62727`

## Plan To Reach 10/10

### 1. Deploy the current app repo to production
- Deploy the latest `main` from `buildingopen/opensky-app`.
- Verify production now shows the new CTA split:
  - primary booking CTA
  - secondary Google Flights compare CTA
- Evidence required:
  - desktop production screenshot
  - mobile production screenshot

### 2. Fix booking-link semantics
- Pick one of these and implement it consistently:
  - **Option A:** Only show `Book` when the provider returned a provider-specific booking URL.
  - **Option B:** Keep fallback links, but rename the CTA so it does not imply an exact booking match.
- Acceptance criteria:
  - no generic marketplace link is labeled as exact booking
  - `Delhi to Nairobi 21st March` no longer misrepresents the destination link
- Evidence required:
  - production screenshot for the Delhi to Nairobi case
  - first outbound CTA href captured from production

### 3. Remove the generic fallback risk in the backend
- Review `_safe_booking_url` in `api/main.py`.
- If the URL is provider-specific, keep it.
- If the URL is a generated fallback, surface it as a compare/search link, not a booking link.
- Acceptance criteria:
  - backend output distinguishes exact booking URLs from marketplace search URLs
  - frontend labels match that distinction

### 4. Clear API dependency CVEs
- Upgrade the FastAPI/Starlette dependency chain until `pip-audit` is clean.
- Re-run:
  - `uvx pip-audit -r api/requirements.txt`
  - API syntax checks
  - app smoke test against production
- Acceptance criteria:
  - zero known vulnerabilities in API requirements

### 5. Re-run final production verification
- On `https://sky.buildingopen.org`, verify all of the following:
  - results page renders
  - production CTA split is live
  - multiline prompt height still works
  - error flow still works
  - desktop and mobile both pass smoke tests
  - results-state accessibility check still passes
- Evidence required:
  - production screenshots
  - fresh audit outputs

## Exit Criteria For 10/10
- Production is running the current app repo UI.
- Booking CTA language matches actual link behavior.
- No generic search link is presented as an exact booking action.
- Web dependency audit is clean.
- API dependency audit is clean.
- Production success, error, desktop, mobile, and multiline checks all pass.
- Production results-state accessibility check passes.

## Verified Evidence From This Revision
- Production desktop check:
  - `/Users/federicodeponte/opensky-app/.tmp/recheck-prod-desktop.png`
- Production mobile check:
  - `/Users/federicodeponte/opensky-app/.tmp/recheck-prod-mobile.png`
- Production multiline input check:
  - `/Users/federicodeponte/opensky-app/.tmp/recheck-prod-multiline.png`
- Production error check:
  - `/Users/federicodeponte/opensky-app/.tmp/recheck-prod-error.png`

## Notes
- This revision is based on production verification, not local assumptions.
- The current local app checkout already appears to contain newer CTA work, so item 1 is at least partly a deployment gap.
