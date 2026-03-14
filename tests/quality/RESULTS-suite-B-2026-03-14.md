# Suite B Results — Flight Data Quality
Date: 2026-03-14
App: https://sky.buildingopen.org

## Infrastructure Note

The deployed API at `https://opensky-api.buildingopen.org` was returning **502 Bad Gateway** throughout testing. The nginx config proxies to `localhost:8090` but nothing is listening on that port. The local API at `localhost:9100` (used by `localhost:4000` and `localhost:3003`) is healthy and functional. All test data was collected via the local API endpoint which uses the same codebase. The browser sessions on localhost:4000 and localhost:3003 confirmed the same UI behavior.

Readyz response from local API: `{"status":"ready","checks":{"zones_loaded":true,"gemini_key":true,"redis":true}}`

---

| Test | Score | Summary |
|------|-------|---------|
| B1 | 3/5 | 3 flights (below 5 threshold); date parsed as Sat Mar 21 not Fri Mar 20; flight data itself is high quality |
| B2 | 5/5 | 41 results; correct airlines, durations, April dates; safety flags on Gulf connections working |
| B3 | 3/5 | 0 results, no crash; correct `no_routes` reason code; but UI shows generic "No flights found" not route-specific explanation |
| B4 | 4/5 | Returns 1 result (not 0), no false safety-filter, correctly shows a convoluted 3-stop connection |
| B5 | 4/5 | 5 unique flights, zero duplicates; date bug (Mar 21 vs Mar 20) inherited from parser |
| B6 | 4/5 | 37 results all priced (€198-€589), no €0 flights, no unpriced flight shown as recommended |
| **Average** | **3.8/5** | |

---

## B1 — High-frequency route
Prompt: `fly from London to Barcelona next Friday economy`
Score: **3/5**
Results count: 3 flights

Sample flights seen:
1. Vueling VY6653 | LHR → BCN | Mar 21 20:50 – 00:05 (+1) | Direct | 2h 15m | €92 | Google
2. KL1006 + KL1519 | LHR → AMS → BCN | Mar 21 11:15 – 19:05 | 1 stop | 6h 50m | €116 | Google
3. A3609 + A3710 | LHR → ATH → BCN | Mar 21 22:15 – 10:25(+1) | 1 stop | 11h 10m | €124 | Google

Issues:
- **DATE BUG (critical):** "next Friday" from Saturday 2026-03-14 should resolve to 2026-03-20 (Friday). API returned 2026-03-21 (Saturday). Gemini parser is off by +1 day. This was confirmed on the same query in browser UI showing "Mar 21". The `PARSE_SYSTEM` prompt injects `today = date.today().isoformat()` but Gemini misinterprets "next Friday" when today is a Saturday — it is returning the next Saturday instead of the next Friday.
- **Result count below threshold:** Only 3 flights returned for London-Barcelona, a major high-frequency route. Threshold is 5. Likely caused by only searching LHR (not LGW, STN) and returning only Google results.
- Data quality of individual cards is good: Vueling is a recognized airline, VY6653 is a plausible flight number format, LHR→BCN is correct, 20:50 is a real departure time, 2h15m is in the 1h30-2h30 plausible range, €92 is in the €30-€300 realistic range.
- No zero prices, no zero durations, no midnight-only times, no blank airlines.

---

## B2 — Long-haul route
Prompt: `fly from Frankfurt to Singapore next month economy`
Score: **5/5**
Results count: 41 flights across 5 April dates

Sample flights seen:
1. EY122 + EY498 | FRA → AUH → SIN | Apr 22 10:55 – Apr 23 09:40 | 1 stop | 16h 45m | €365 | Google | ⚠ Caution (Gulf States)
2. SQ325 | FRA → SIN | Apr 22 21:40 – Apr 23 16:20 | Direct | 12h 40m | €428 | Google
3. LH780 | FRA → SIN | Apr 15 21:50 – Apr 16 16:30 | Direct | 12h 40m | €440 | Google
4. AI2026 + AI2115 | FRA → DEL → SIN | Apr 22 12:10 – Apr 23 12:10 | 1 stop | 18h | €505 | Google
5. KL1822 + KL835 | FRA → AMS → SIN | Apr 29 18:40 – Apr 30 15:40 | 1 stop | 15h | €613 | Google

Issues: None.

Notes:
- "Next month" correctly parsed as April (5 sampled dates: Apr 1, 8, 15, 22, 29).
- Airlines recognizable: SQ (Singapore Airlines), LH (Lufthansa), EY (Etihad), AI (Air India), KL (KLM).
- Direct FRA→SIN duration 760min (12h40m) is plausible and correct.
- Prices €365-€613 are within expected €400-€1200 range (Etihad at €365 is slightly below minimum but plausible for a sale fare).
- Connecting airports: AUH (Abu Dhabi), MCT (Muscat), BAH (Bahrain), DEL (Delhi), AMS — all geographically plausible for FRA→SIN.
- Safety flags working correctly: AUH, MCT, BAH flights tagged "caution" (Gulf States Proximity Advisory) and shown separately from "safe" routes.
- All dates in April 2026, not March 14 (test date).

---

## B3 — Safety filter route
Prompt: `fly from Istanbul to Tel Aviv next week`
Score: **3/5**
Results count: 0 flights

API response: `{"flights": [], "count": 0, "no_results_reason": "no_routes"}`

UI message shown: "No flights found." / "No flights match this route and date. Try nearby airports or different dates."

Issues:
- **Weak no-results explanation:** The UI shows a generic "No flights found" message. The test spec requires the message to explain WHY no results were found. The API correctly distinguishes `no_routes` from `safety_filtered`, but the frontend only renders two paths: `safety_filtered` (shows "All routes pass through conflict zones") and everything else (generic "No flights found"). The `no_routes` case falls into the generic fallback with no route-specific language.
- The app correctly does NOT say "safety filtered" for this route — IST→TLV is not filtered on conflict zones, it simply has no commercial routes available in the provider data (Turkish Airlines suspended IST-TLV flights; El Al is not in the Duffel/Google search). This is the correct behavior.
- No crash, no blank screen.

---

## B4 — No-flights route
Prompt: `fly from Erfurt to Palermo next week`
Score: **4/5**
Results count: 1 flight (3-stop connection)

Flight found:
- EW6863 + LH1159 + LH242 + AZ1777 | ERF → PMI → FRA → FCO → PMO | Mar 17 10:50 – Mar 18 09:20 | 3 stops | 22h 30m | €435 | Google

Issues:
- Contrary to test expectation, the app found 1 result: a very convoluted 3-stop connection via Mallorca, Frankfurt, and Rome. This means the test hypothesis ("no direct to PMO") held but an indirect connection was found.
- App correctly does NOT show "safety filtered" (it's not a safety issue).
- No crash, no blank screen.
- The single result is a legitimate (if extreme) connection — the data is technically accurate.
- Minor concern: €435 for a 22h30m 3-stop ERF-PMO journey is poor value and may confuse users, but it's valid data.

---

## B5 — Deduplication
Prompt: `fly from Amsterdam to Rome next Friday`
Score: **4/5**
Results count: 5 flights

Flights seen (airline + flight number + date):
1. VY8308 + VY6114 | AMS → BCN → FCO | Mar 21 07:00 – 19:50 | 1 stop | 12h 50m | €216
2. AF1651 + AF1004 | AMS → CDG → FCO | Mar 21 15:50 – 22:45 | 1 stop | 6h 55m | €257
3. LX735 + LX1726 | AMS → ZRH → FCO | Mar 21 20:00 – Mar 22 08:40 | 1 stop | 12h 40m | €255
4. AZ121 + AZ2071 | AMS → LIN → FCO | Mar 21 11:50 – 16:40 | 1 stop | 4h 50m | €274
5. KL1601 | AMS → FCO | Mar 21 06:55 – 09:10 | Direct | 2h 15m | €326

Issues:
- **No duplicates found.** All 5 flights have unique airline+flight number combinations on the same date. Deduplication is working correctly.
- **Date bug inherited from parser:** Again shows Mar 21 (Saturday) instead of Mar 20 (Friday) — same Gemini parsing issue as B1.
- App correctly resolved "Rome" to FCO (Fiumicino). Only one Rome airport searched; CIA (Ciampino) not included — this is acceptable behavior.

---

## B6 — Unpriced flights
Prompt: `fly from Vienna to Reykjavik next week`
Score: **4/5**
Results count: 37 flights, all priced

Lowest price: €198 (AY1476 + AY991 | VIE → HEL → KEF | Mar 20 19:15 – Mar 21 09:15 | 1 stop | 15h)
Highest price seen: €589

Sample flights:
1. AY1476 + AY991 | VIE → HEL → KEF | Mar 20 | 15h | €198 | Finnair
2. AY1476 + AY995 | VIE → HEL → KEF | Mar 18 | 14h 45m | €219 | Finnair
3. EW9751 + EW9280 | VIE → DUS → KEF | Mar 21 | 8h 15m | €298 | Eurowings
4. BT274 + BT169 | VIE → RIX → KEF | Mar 20 | 18h 20m | €322 | Air Baltic
5. SK1694 + SK2595 | VIE → CPH → KEF | Mar 17 | 7h 35m | €427 | SAS

Issues:
- **No unpriced (€0) flights found.** The test hypothesis that VIE→KEF might have price=0 flights did not materialise; all 37 results have real prices. The unpriced flight scenario could not be validated on this route.
- All prices are realistic (€198-€589 for a niche route is expected).
- Connecting airports all plausible for VIE→KEF routing: HEL (Helsinki), DUS (Düsseldorf), RIX (Riga), CPH (Copenhagen), WAW (Warsaw), ZRH (Zurich).
- The "price unavailable" display path exists in the code (`flights.every(f => f.price === 0)` shows a warning banner) but was not triggered on this route.

---

## Critical Issues

### CRITICAL: Deployed API is down (502 Bad Gateway)
- `https://opensky-api.buildingopen.org` returns 502 for all requests.
- nginx proxies to `localhost:8090` but nothing is listening on that port.
- `localhost:9100` (the actual API) is healthy. The nginx config needs updating to point to port 9100 instead of 8090.
- **Impact:** The live app at `https://sky.buildingopen.org` is broken for all users — every search returns "Could not reach the search API."

### BUG: "Next Friday" date parsing is off by +1 day (Saturday returned instead of Friday)
- Affects: B1, B5 (and likely any query with "next Friday" or "next [weekday]" submitted on a Saturday)
- When today is Saturday 2026-03-14, "next Friday" should resolve to 2026-03-20 (Friday). Gemini returns 2026-03-21 (Saturday).
- The system prompt correctly injects `Today's date is 2026-03-14` and instructs Gemini to "calculate from today". However Gemini's interpretation of "next Friday" from a Saturday is wrong — it returns the date +7 days from the current weekday's equivalent, not the actual next occurrence of Friday.
- Confirmed in browser UI: departure date shows "Mar 21" for "next Friday economy" queries.

### MINOR: B3 no-results message is too generic
- When `no_results_reason === "no_routes"` the frontend falls into the catch-all branch and shows "No flights found. / No flights match this route and date. Try nearby airports or different dates."
- This is technically true but unhelpful. A more specific message ("No commercial flights found on this route — it may be suspended or not served by our providers") would improve user trust.
- The API already distinguishes `no_routes` from `safety_filtered` — the frontend just needs an additional branch to use this information.

### MINOR: B1 returns only 3 results for London-Barcelona
- LHR only is searched (not LGW or STN). Even for LHR alone, 3 results on a major route on a single date seems low. Other routes returned many more results per date.
