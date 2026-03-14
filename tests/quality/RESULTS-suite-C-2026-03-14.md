# Suite C Results — UX Clarity
Date: 2026-03-14
App: https://sky.buildingopen.org (tested on localhost:4000 — live API returned 502 throughout)

## Infrastructure Note

The deployed API at `https://opensky-api.buildingopen.org` was returning **502 Bad Gateway** throughout testing. The local API at `localhost:9100` and UI at `localhost:4000` are healthy and use identical code. All tests were run against the local environment.

---

| Test | Score | Summary |
|------|-------|---------|
| C1 | 3/5 | Economy cabin chip deliberately omitted; "any" stops chip omitted; chips show airport codes only (LHR not "London Heathrow") |
| C2 | 5/5 | Date on card correctly shows actual departure date from flight data (not today's date) |
| C3 | 1/5 | Round trip query only shows outbound flights; no return leg, no total price, no "Round trip" chip |
| C4 | 5/5 | No stale-cache banner when results are fresh; banner only appears after 30 min threshold (correct) |
| C5 | 5/5 | Three-dot animated spinner + "Understanding your trip..." during parse; per-route progress bar + "Scanning route X/Y" during search; button becomes "Searching..." |
| C6 | 4/5 | Share URL generated correctly; auto-populates and auto-searches on load; referral banner shown; URL bar does not update on normal search |
| C7 | 4/5 | Button correctly labeled "Skyscanner" (not "Book direct"); opens pre-filled Skyscanner search; tooltip clarifies it is a search not a booking |
| C8 | 3/5 | Empty state renders correctly with "No flights found." and suggestion; `safety_filtered` reason code exists in frontend but API never emits it (dead branch); `no_routes` falls through to generic message |
| **Average** | **3.75/5** | |

---

## C1 — Parsed config visibility
Prompt: `fly from London to Barcelona next Friday economy`
Score: **3/5**

Chips visible after search completed:
```
LHR  →  BCN  |  Mar 21
```
(LHR and BCN rendered in monospace; arrow between them; pipe separator; date "Mar 21")

**What is shown:**
- Origin airport code (LHR)
- Destination airport code (BCN)
- Departure date (Mar 21)

**What is missing:**
- **Cabin class chip**: Economy is deliberately not shown. Code at `page.tsx:643`: `{cabin && cabin !== "economy" && (...)}`. Rationale is that economy is the default so showing it would be noise. However, a user who searched economy and sees no cabin chip cannot confirm their cabin preference was registered. Premium economy, business, and first class do get chips.
- **Stops chip**: "any" stops is not shown. Code at `page.tsx:647`: `{stops && stops !== "any" && (...)}`. Same rationale — "any" is the default. But the user cannot confirm whether the search was restricted.
- **Airport names**: Shows only IATA codes (LHR, BCN) in monospace. No full airport names. A non-frequent-flyer may not recognize LHR. The `airport_names` object is returned by the API (e.g. `{"KEF": "Reykjavik", "WLG": "Wellington"}`) but is not rendered in the chips.

**Code reference:** `ParsedConfig` component, `page.tsx:609–661`.

Issues:
- Economy searches give no visual confirmation that cabin class was parsed (3-star deduction).
- IATA codes only — no airport name disambiguation.

---

## C2 — Date on card vs search date
Prompt: `fly from London to Barcelona next Friday economy`
Score: **5/5**

**Verification method:** Compared the date chip shown on the flight card against the `legs[0].departs` field in the API results event.

- Today's date: 2026-03-14 (Saturday)
- Searched: "next Friday" — parsed as 2026-03-21
- Flight card displayed: **Mar 21**
- `legs[0].departs` from API: `"2026-03-21T20:50:00"` (Vueling VY6653)

The card date correctly reflects the actual departure date from the flight data, not today's date and not the query date independent of what was found.

**Code reference:** `flightDisplayDate` function in `FlightCard` uses `flight.legs[0].departs.slice(0, 10)` which reads the actual departure from the legs array, not the searched date.

No issues found.

---

## C3 — Round trip card layout
Prompt: `fly from Berlin to New York May 10 returning May 20`
Score: **1/5**

**Observed behavior:**

Chips after search:
```
BER  →  JFK  |  May 10
```

Only **outbound flights** were returned in the recommendations section. No return leg section was present. No total price was shown.

Verified via JavaScript `document.body.innerText` extraction:
- `hasRoundTripOptions = false`
- `hasReturnSection = false`
- `hasRoundTripChip = false`
- Only 2 recommendation cards shown, both for the outbound (BER→JFK) leg

**API response analysis:**

The API correctly parsed the return date:
```json
{
  "origins": ["BER"],
  "destinations": ["JFK"],
  "dates": ["2026-05-10"],
  "return_dates": ["2026-05-20"]
}
```

However, the `round_trip_results` array in the response was empty (`[]`). When `round_trip_results` is empty, the frontend falls back to showing `flights` (outbound only). The May 10→May 20 date range may have exceeded the booking horizon for paired round-trip searches, or the round-trip scan found no matchable outbound+return pairs.

**Code reference:** `RoundTripCard` component at `page.tsx:354–452` handles the paired layout (with "Outbound", "Return", "Two bookings required" labels, combined price). `ParsedConfig` at `page.tsx:620–635` would show "Round trip" chip and return dates when `isRoundTrip = return_dates && return_dates.length > 0`. Neither component was triggered.

**Issues (critical):**
1. Round trip search silently degrades to outbound-only. No "Round trip" chip in parsed config means the user does not know whether their return date was registered.
2. No "Return date: May 20" chip rendered despite `return_dates: ["2026-05-20"]` being present in parsed output — the parsed config chip IS gated on `return_dates.length > 0` but the `parsed` state in the frontend may not have received `return_dates` properly, or the round-trip scan completed with 0 paired results causing the code to never set that state. Further investigation needed.
3. No "Return flights not found" message is shown when the round-trip scan fails. The user sees outbound results with no indication that the return leg was attempted or failed.
4. The `RoundTripCard` component exists and handles the correct layout — the bug is in the search/result propagation, not the display component itself.

---

## C4 — Staleness banner
Prompt: `fly from London to Barcelona next Friday economy` (run, then immediately run again)
Score: **5/5**

**First search:**
- API `cache_age_seconds`: 185 (approximately 3 minutes old)
- Banner shown: **none** (correct — 185 < 1800 threshold)

**Immediate second search (cache hit):**
- Same cache, same `cache_age_seconds`
- Banner shown: **none** (correct — still under 30-minute threshold)

**Code reference:** Cache banner at `page.tsx:1280`: `{cacheAgeSeconds !== null && cacheAgeSeconds > 1800 && (...)}`. Threshold is 30 minutes. Banner text: "Prices from ~X min ago — may have changed. Refresh" with a re-search button.

The design is intentional: minor caching (seconds to a few minutes) is transparent to the user, while stale prices (30+ minutes) trigger a visible warning. Correct behavior.

No issues found.

---

## C5 — Progress indicator during search
Prompt: `fly from London to Barcelona next Friday economy`
Score: **5/5**

**Phase 1 — Parse phase (0–~500ms):**
- Three animated pulsing dots appear immediately
- Text: "Understanding your trip..."
- Search button changes to "Searching..." with `aria-busy=true`, disabled state
- No route/date information yet (AI is parsing the NL query)

**Phase 2 — Search phase (after parse):**
- Text updates to: "Scanning route X/Y – ROUTE on DATE"
  - Example: "Scanning route 1/1 – LHR → BCN on Mar 21"
- Progress bar appears (width proportional to done/total)
- Route and date are specific to the current scan

**Completion:**
- Loading state disappears cleanly
- Results appear without flicker

**Code reference:** `SearchingState` component at `page.tsx:464–490`. Parse phase shows the three-dot animation. Search phase shows `Scanning route {done}/{total} – {route} on {date}` with `<progress>` element.

**Note on progress granularity:** For single-route searches (1/1), the progress bar jumps from 0% to 100% in one step. For multi-route searches (multi-origin, multi-date), it counts each route individually. This is appropriate.

No issues found.

---

## C6 — Share URL
Prompt: `fly from London to Barcelona next Friday economy`
Score: **4/5**

**Share URL generated:**
```
http://localhost:4000/?q=fly+from+London+to+Barcelona+next+Friday+economy&ref=share&utm_source=share
```

**When share URL is opened in new tab:**
- Textarea is pre-populated with the original prompt
- Search auto-starts immediately
- Referral banner shown: "You were shared a recommendation. Search below to see safer flight options for your trip."
- "Copy link" button visible in the results area

**What works well:**
- Full NL query is preserved in the URL (not just parsed parameters) — robust to re-parsing
- `utm_source=share` and `ref=share` present for analytics

**Issues:**
1. **URL does not reflect current search in the browser address bar.** During a normal search session, the browser URL remains at the root (`http://localhost:4000/`). The URL only becomes a share URL after clicking "Copy link". A user refreshing the page mid-session loses their search. Some competitors (e.g. Google Flights) update the URL on every search so the browser Back button and bookmarks work.
2. For multi-date searches (where the query might encode multiple dates), the share URL preserves the entire NL query which includes the original date language (e.g. "next Friday"). When shared, "next Friday" will resolve to a different date than when originally searched. This is a semantic drift issue inherent to encoding relative dates in the query rather than absolute dates.

**Code reference:** `getShareUrl()` at `page.tsx:931–964`. Uses `encodeURIComponent(query)` where `query` is the raw textarea input, not the parsed parameters.

---

## C7 — Booking link label and destination
Prompt: `fly from London to Barcelona next Friday economy`
Score: **4/5**

**Booking button observed on flight card (Vueling VY6653):**
- Label: **"Skyscanner"** (not "Book direct" — correct since this is not an exact booking link)
- `aria-label`: `"Search on Skyscanner"`
- `title` tooltip: `"Opens a Skyscanner search — you'll need to find this exact flight again"`

**Skyscanner URL generated:**
```
https://www.skyscanner.net/transport/flights/lhr/bcn/260321/?adultsv2=1&cabinclass=economy&currency=EUR&sortby=cheapest&preferDirects=false
```

URL correctly encodes:
- Origin: `lhr`
- Destination: `bcn`
- Date: `260321` (26 Mar 21 = 2026-03-21)
- Cabin: `economy`
- Currency: `EUR`

A second "Google" button links to Google Flights with the same route pre-filled.

**Issues:**
1. **"Searching again" burden disclosed only in tooltip.** The title text "you'll need to find this exact flight again" is only visible on hover (desktop) and invisible on mobile. A user who clicks expects a direct booking link. The flight number is not passed to Skyscanner, so finding the exact flight requires another manual search. This should be surfaced more prominently — a one-line note under the button or a persistent label.
2. **`booking_exact: false`** for all observed flights means the label "Skyscanner" is always shown (not "Book direct"). The `booking_exact: true` path (which shows "Book direct") was never triggered in testing. This may be by design if the API always routes through Skyscanner's search rather than deep-link booking.

**Code reference:** `FlightCard` booking button at `page.tsx:316–345`. Label logic: `booking_exact ? "Book direct" : "Skyscanner"`.

---

## C8 — Empty results messaging
Prompt: `fly from Istanbul to Tel Aviv next week` (known no-results route — IST→TLV has no commercial flights in provider data)
Score: **3/5**

**API response:**
```json
{"flights": [], "count": 0, "no_results_reason": "no_routes"}
```

**UI empty state shown:**
```
No flights found.
No flights match this route and date. Try nearby airports or different dates.
```

**What works:**
- Not a blank white screen
- Not a generic "Something went wrong" error
- Shows a specific suggestion ("Try nearby airports or different dates")
- Renders without crash

**Issues:**

1. **`safety_filtered` branch is dead code.** The frontend has three branches for `noResultsReason`:
   - `"provider_error"` → "Flight data unavailable right now."
   - `"safety_filtered"` → "All routes pass through conflict zones."
   - default → "No flights found."

   However, the API (`main.py:1138–1171`) only ever emits `"provider_error"` or `"no_routes"`. It never emits `"safety_filtered"`. The frontend's `safety_filtered` branch will never render in production. This means a safety-filtered route (e.g. a route where all options pass through conflict zones) will show the generic "No flights found" message, which is misleading — the user may try again thinking it's a data issue.

2. **`"no_routes"` reason is swallowed.** The API distinguishes `"provider_error"` (all providers failed) from `"no_routes"` (data returned but no flights exist). The frontend maps `"no_routes"` to the default message, same as a null reason. A message like "No commercial flights operate on this route" would be more accurate than "No flights match this route and date."

3. **No "Return date before departure" message.** The test plan mentions this as a possible message, but no such UI state exists in the code. The API does not produce this as a `no_results_reason` variant.

**Code reference:**
- Frontend empty state: `page.tsx:1246–1270`
- API reason generation: `main.py:1138–1171`

---

## Critical Bugs

### BUG-C3: Round trip search silently returns outbound only
**Severity: High**
A round trip query (with explicit return date) returns only outbound results. The "Round trip" chip is never shown. The return date is never rendered. The user has no feedback that their return leg was searched or failed. The `RoundTripCard` component and its paired layout exist and work, but the `round_trip_results` array comes back empty from the search scan (possibly due to booking horizon constraints on future dates like May 10/20).

Reproduction: `fly from Berlin to New York May 10 returning May 20`

### BUG-C1: Economy cabin class silently omitted from config chips
**Severity: Medium**
Economy searches show no cabin chip. For a user who wanted to check their search parameters, they cannot confirm cabin class was registered. The omission is intentional in the code (`cabin !== "economy"` guard) but is a UX gap — at minimum economy could show briefly or be implied via tooltip.

---

## Recommendations

1. **C3 round trip:** When `round_trip_results` is empty despite `return_dates` being non-empty in the parsed config, show an explicit message: "Found outbound flights — no matching return flights for May 20. Try adjusting your return date." Do not silently degrade to outbound-only results.

2. **C1 airport names:** Render full airport names on hover or as a subtitle below the code: `LHR` → `Heathrow`. The API already returns `airport_names` but the UI does not use it in the chips.

3. **C8 safety_filtered:** Wire up the `safety_filtered` no-results reason in the API. When all scanned routes pass through a conflict zone and are filtered, emit `"safety_filtered"`. The frontend UI branch already exists and renders the correct message.

4. **C8 no_routes specificity:** Differentiate `"no_routes"` from null in the frontend. "No commercial flights operate on this route" is clearer than "No flights match this route and date."

5. **C6 URL state:** Consider updating the browser URL on each search (using `history.pushState`) so that refreshing the page or using the Back button restores the search. This also makes the browser URL a natural share link without needing a separate "Copy link" step.

6. **C7 booking transparency:** Add a persistent one-line note below each flight card's booking button: "You will need to find this flight again on Skyscanner." The tooltip is invisible on mobile and easy to miss on desktop.
