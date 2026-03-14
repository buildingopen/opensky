# Suite D Results — Edge Cases
Date: 2026-03-14
App: https://sky.buildingopen.org

## Infrastructure Note

The deployed API at `https://opensky-api.buildingopen.org` is returning **502 Bad Gateway** for all requests (same issue as Suite B). The nginx config at `/etc/nginx/sites-enabled/opensky-api` proxies to `localhost:8090` but nothing is listening there. The `opensky-api.service` systemd unit fails to start because `/opt/opensky/repo/api/main.py` no longer exists (the repo was restructured to `src/opensky/` layout, but the service's `WorkingDirectory` was not updated).

All test data was collected via the local API (`localhost:9100`, running from `/root/opensky-app/api/`) which uses the same codebase. The browser sessions on `localhost:4000` confirmed the same UI behavior.

When tested on the live production URL (`https://sky.buildingopen.org`), every search returns "Could not reach the search API. Please try again." — this is an accurate and user-friendly message, but all four tests are functionally blocked for production users.

---

| Test | Score | Summary |
|------|-------|---------|
| D1 | 5/5 | "today" parsed as 2026-03-14; only future departures shown (19:00, 18:20, 19:55, 20:45 CET); 5 flights found |
| D2 | 4/5 | Dec 25 parsed as 2026-12-25; 10 results; plausible airlines and durations; recommended flight shows "Caution" with no explanation visible in summary |
| D3 | 4/5 | Gibberish returns clear "Could not understand origin or destination" message; no crash; no results shown; message placement could be more prominent |
| D4 | 2/5 | Same-origin search runs silently (AMS→AMS for 7 dates); shows generic "No flights found"; no specific same-origin/destination error |
| **Average** | **3.75/5** | |

---

## D1 — Very short notice
Prompt: `fly from Paris to Berlin today`
Score: **5/5**

What I saw:
- Parsed config chip: `CDG → BER | Mar 14`
- Date correctly interpreted as 2026-03-14
- RECOMMENDED: Paris (CDG) → Berlin (BER), easyJet, Mar 14 **19:00 – 20:45**, Direct, 1h 45m, €131
- 5 total flights found, price range €131–€331
- All departure times are in the future (relative to ~16:00 CET when tested):
  - 18:20 CDG→MUC→BER (Lufthansa, 1 stop)
  - 19:00 CDG→BER (easyJet, direct)
  - 19:55 CDG→ZRH→BER (SWISS, overnight connection)
  - 20:10 CDG→VIE→BER (Austrian, overnight connection)
  - 20:45 CDG→AMS→BER (KLM, overnight connection)

Issues: None. The app correctly resolved "today" to 2026-03-14, showed only future-departing flights, and the recommended flight (direct easyJet at 19:00) is a realistic choice for same-day travel.

---

## D2 — Far future date
Prompt: `fly from London to Tokyo December 25`
Score: **4/5**

What I saw:
- Parsed config chip: `LHR → NRT | Dec 25`
- Date correctly interpreted as 2026-12-25
- RECOMMENDED: London (LHR) → DXB → BWN → Tokyo (NRT), Royal Brunei (BI), Dec 25 16:55 – Dec 26 07:30, 2 stops, 29h 35m, €619 — **marked "Caution"**
- FASTEST: London (LHR) → ICN → Tokyo (NRT), Asiana (OZ), Dec 25 20:10 – Dec 26 21:00, 1 stop, 15h 50m, €1129
- LOWEST STRESS: London (LHR) → TPE → Tokyo (NRT), China Airlines (CI), Dec 25 21:15 – Dec 27 18:30, 1 stop, 36h 15m, €773
- 10 total flights, €619–€1129
- Airlines: Royal Brunei, Asiana (OZ), China Airlines (CI), KLM (KL), Lufthansa + others

Issues:
- **Minor: Recommended flight has "Caution" risk level.** The app recommends a "Caution"-flagged flight (LHR→DXB→BWN→NRT via Dubai and Brunei) as its top pick. While the explanation "Safest option among available routes" appears under the card header, users may be confused why the "RECOMMENDED" flight carries a caution badge. The route via UAE airspace is flagged by the safety system but considered the best available. This could be clearer — e.g. adding "shown because no fully-safe routes were found."
- No red flags: date not parsed as 2025-12-25, all prices are non-zero, results are plentiful, airlines are plausible for LHR-NRT routing.

---

## D3 — Gibberish
Prompt: `xkcd banana 42 fly somewhere`
Score: **4/5**

What I saw:
- API returned HTTP 400 immediately (no search was attempted)
- UI message shown: **"Could not understand origin or destination from your prompt."**
- The home page / search form remained intact
- Suggestion chips (JFK to London, Barcelona to Paris, etc.) remained visible
- No crash, no stack trace, no empty results area, no JSON error

Issues:
- **Minor: Error message placement is easy to miss.** The error message appears at the bottom of the page below the suggestion chips, in a small text block near the footer area. It is shown via an ARIA live region (`role="alert"`) but visually sits well below the fold in a low-contrast location. A more prominent in-context error message (e.g., below the textarea or in a highlighted banner) would be more user-friendly.
- The message content itself is clear and human-readable. It does not expose any internal details.

---

## D4 — Same origin/destination
Prompt: `fly from Amsterdam to Amsterdam next week`
Score: **2/5**

What I saw:
- Parsed config chip: `AMS → AMS | Mar 16 +6 more`
- The app parsed `AMS` as both origin and destination — same IATA code
- Ran the full search across 7 dates (Mon–Sun next week)
- API returned 0 results with `no_results_reason: "no_routes"`
- UI message shown: **"No flights found. No flights match this route and date. Try nearby airports or different dates."**

Issues:
- **FAIL: No same-origin/destination detection.** The app silently ran 7 API calls (one per date) for the AMS→AMS route before returning the generic no-results message. The API does not catch the same-origin/destination case before searching, and the frontend shows a generic "No flights found" with the misleading suggestion "Try nearby airports or different dates." — when the real issue is the origin equals the destination.
- **Misleading guidance:** "Try nearby airports" makes no sense here. The user should be told: "Origin and destination are the same — please enter different cities."
- **Wasted searches:** 7 API calls were made for a logically invalid query. A pre-search validation step (either in the parser response or the frontend) would catch this instantly and save API quota.
- The chip shows `AMS → AMS` so the parse was technically correct — the issue is that no downstream validation rejects same-origin routes.
- No crash, no blank screen — the failure mode is silent and misleading rather than catastrophic.

---

## Critical Issues

### HIGH: D4 — No same-origin/destination guard
- Route: AMS → AMS
- The app runs 7 full API calls for an obviously invalid query.
- The no-results message ("Try nearby airports or different dates") is wrong guidance for this case.
- Fix: Add validation in the parser or frontend: if `origins[0] === destinations[0]`, return an error message like "Origin and destination are the same — please enter different cities." before any search is initiated.
- This validation already exists in some form in the API (`no_results_reason: "no_routes"`) but the frontend does not use the reason code to give a specific message for same-origin queries.

### MEDIUM: D2 — Recommended flight has "Caution" rating with no context
- The recommended card shows "Caution" badge alongside "RECOMMENDED" header.
- While the text says "Safest option among available routes," the visual juxtaposition of RECOMMENDED + Caution is confusing.
- Fix: When all available routes carry a Caution or higher flag, add a note like "No fully-safe routes available — showing best option from routes with lower risk."

### MINOR: D3 — Error message placement is below the fold
- "Could not understand origin or destination" appears near the footer, below all suggestion chips.
- Fix: Move the error message inline, directly below the textarea and Search button.

### PRE-EXISTING: Production API is still down (502)
- As documented in Suite B: `opensky-api.buildingopen.org` returns 502 because the systemd service (`opensky-api.service`) points to the wrong working directory (`/opt/opensky/repo/api/`) after the repo restructure.
- Fix: Update `WorkingDirectory` in `/etc/systemd/system/opensky-api.service` from `/opt/opensky/repo/api` to `/root/opensky-app/api` and update nginx to proxy to port 9100 instead of 8090.
