# OpenSky Quality Test Plan

Live app: https://sky.buildingopen.org

This plan is for **manual subagent evaluation** — navigate the app, enter each prompt,
wait for results, then grade output against the rubric. Focus on data quality and UX,
not technical button presence.

---

## How to Run

1. Open the app in a browser
2. For each test case: paste the prompt, submit, wait for completion
3. Capture a screenshot of the full results
4. Grade each criterion: PASS / FAIL / PARTIAL with a one-line note
5. Record any unexpected behavior verbatim
6. Summarise findings in `RESULTS-YYYY-MM-DD.md` in this folder

---

## Scoring Rubric (per test)

| Score | Meaning |
|-------|---------|
| 5/5 | Exactly right — data makes sense, UX is clear |
| 4/5 | Minor issue (one wrong field, slightly confusing label) |
| 3/5 | Significant issue but still usable |
| 2/5 | Misleading or mostly wrong |
| 1/5 | Broken, no results, or dangerous misinformation |

Overall test suite score = average across all tests.

---

## Test Suite A — Prompt Parsing Quality

Goal: verify Gemini interprets the prompt correctly and the parsed config chips reflect it.

### A1 — Simple one-way
```
fly from Berlin to Rome next Friday economy
```
**Check parsed config chips show:**
- Origin: BER (or TXL/SXF/BER)
- Destination: FCO (or CIA/FCO)
- Date: the correct upcoming Friday (not today, not a week off)
- Cabin: Economy
- No round-trip indicator

**Red flags:**
- Date is wrong by >1 day
- Cabin shows "Business" or blank
- Destination is MXP (Milan) instead of Rome airports

---

### A2 — Round trip
```
round trip Berlin to New York May 10 returning May 20
```
**Check:**
- Round trip badge visible
- Outbound date: May 10
- Return date: May 20
- Origin: BER, Destination: JFK/EWR/LGA

**Red flags:**
- Treated as one-way
- Return date missing or wrong
- "returning May 20" ignored

---

### A3 — Budget constraint
```
cheapest flights from Madrid to Lisbon this weekend under 80 euros
```
**Check:**
- Max price chip shows €80
- Results (if any) are all ≤ €80
- Date range covers Saturday + Sunday of the current weekend

**Red flags:**
- Results include flights above €80
- Max price chip absent
- Weekend dates wrong (e.g. next weekend, or a weekday)

---

### A4 — Multi-origin
```
fly from London or Amsterdam to Bangkok in June, economy, any stops
```
**Check:**
- Two origin airports shown (LHR/LGW and AMS)
- Destination: BKK/DMK
- Date range covers multiple June dates
- Stops: Any

**Red flags:**
- Only one origin used
- "or" interpreted as a single city

---

### A5 — Stops preference
```
direct flights only from Frankfurt to Tokyo next month
```
**Check:**
- Stops chip shows "Direct only" or "Non-stop"
- Results show 0 stops (single leg FRA→NRT/HND)

**Red flags:**
- Results include connecting flights (1+ stops)
- Stops chip missing

---

### A6 — Anywhere prompt
```
fly somewhere warm from Paris in March under 300 euros
```
**Check:**
- Multiple destinations shown (should be 10-15 warm-weather airports, not just 1-2)
- Mix of regions: Mediterranean, Caribbean, Southeast Asia, North Africa
- Not just London/Amsterdam (cold) in the list
- Max price €300 chip visible

**Red flags:**
- Only 1-2 destinations
- All destinations are European city hubs (not warm)
- €300 limit ignored

---

### A7 — Business class
```
business class from Dubai to Singapore next week
```
**Check:**
- Cabin chip shows "Business"
- If results exist: prices are in business class range (>€500 typically)
- If no results: clear reason shown, not silent empty

**Red flags:**
- Results show economy prices (€50-150 range) — wrong cabin
- Cabin chip shows "Economy"

---

### A8 — Impossible return date (UX guard)
```
fly Berlin to Paris March 20 returning March 15
```
**Check:**
- App does NOT run a return search
- User sees a warning: something like "Return date before departure — treated as one-way"
- Results show outbound March 20 flights only (if any)

**Red flags:**
- App runs both searches, shows March 15 return flights (wrong)
- Silent failure, no warning
- App crashes

---

## Test Suite B — Flight Data Quality

Goal: verify the actual flight results are real, accurate, and sensible.

### B1 — High-frequency route (many flights expected)
```
fly from London to Barcelona next Friday economy
```
**Check per result:**
- Airline name recognisable (Vueling, EasyJet, BA, Ryanair, Iberia etc.)
- Flight number present and plausible format (VY1234, IB3456)
- Departure and arrival airports are real LHR/LGW/STN → BCN
- Departure time looks like a real flight time (not 00:00 or 12:34:56.000)
- Duration is plausible (1h30-2h30 for LHR-BCN)
- Price in a realistic range (€30-€300 economy)
- At least 5 results returned

**Red flags:**
- Duration shows 0 minutes
- Price shows €0 or €99999
- Departure time is midnight for every flight (data artefact)
- Airline is "Unknown" or empty
- Flight number is blank

---

### B2 — Long-haul route
```
fly from Frankfurt to Singapore next month economy
```
**Check per result:**
- Airlines: Lufthansa, Singapore Airlines, Emirates, Qatar etc.
- Duration: 11-14h for direct, 14-20h with stop
- Prices: €400-€1200 range for economy
- Connecting airports are plausible (DXB, DOH, HKG, CDG etc.)
- Departure date on the card matches the actual leg departure, not the search date

**Red flags:**
- Duration shows 3 hours (data error — no FRA-SIN direct in 3h)
- Price shows €50 (not realistic for this route)
- Date on card is the search date rather than the flight date

---

### B3 — Route with safety filter expected
```
fly from Istanbul to Tel Aviv next week
```
**Check:**
- App either returns results or shows a specific reason why not
- If no results: should show "safety_filtered" style message (conflict zone routing)
- If results: check that they are real airlines (El Al, Turkish, etc.) and prices are realistic

**Red flags:**
- Generic "No flights found" with no reason
- Results shown with safety badge but route passes through active conflict zone airports

---

### B4 — No-flights route (tiny airports)
```
fly from Erfurt to Palermo next week
```
Erfurt (ERF) has very few routes. Palermo (PMO) is not well-connected from ERF.

**Check:**
- App shows "no routes" style message, not "safety filtered"
- Does NOT show 0 results silently (should explain why)

**Red flags:**
- Shows "All routes blocked by safety filter" (wrong reason)
- Crashes or shows error

---

### B5 — Deduplication check
```
fly from Amsterdam to Rome next Friday
```
AMS-FCO is served by many airlines. With Google Flights as only provider, deduplication
is less critical, but still check:
- Same flight (same airline + flight number + date) does not appear twice
- If a flight appears twice: note the duplicate airline and flight number

---

### B6 — Unpriced flights
```
fly from Vienna to Reykjavik next week
```
This is a low-frequency route. Some results may have price=0.

**Check:**
- Unpriced flights (€0) do NOT carry a "Recommended" / "Cheapest" / "Fastest" badge
- If all flights are unpriced: they are shown but clearly marked as price-unavailable
- No flight with €0 price appears at the top of the list as a recommendation

---

## Test Suite C — UX Clarity

Goal: verify the interface communicates clearly what was searched and what was found.

### C1 — Parsed config visibility
After any search, look at the config chips under the search bar.

**Check:**
- Every searched parameter is shown: origin(s), destination(s), date(s), cabin, stops, max price (if set)
- If >3 dates: shows "Mar 10 … +4 more" (collapsed)
- Round-trip shows outbound + return dates separately
- No chip is blank or shows raw code (e.g. "non_stop" instead of "Direct only")

---

### C2 — Date on card vs search date
After B1 or B2, check the date shown on each flight card.

**Check:**
- The date on the card matches the actual departure from `legs[0].departs`
- Not the date you searched (e.g. if you searched "next Friday" = Mar 21, card should show Mar 21, not today)

**How to verify:** Compare the date chip on the card against the departure time field in the flight detail.

---

### C3 — Round trip card layout
After A2, look at the round-trip results.

**Check:**
- Outbound and inbound shown as two stacked rows (not two separate cards)
- Combined total price is prominent
- Both legs show: airline, route (BER→JFK), departure time, duration, stops
- Booking note: "Two bookings required" or similar
- Separate booking buttons for each leg

**Red flags:**
- Only outbound shown, return missing
- Total price missing, only per-leg price
- No visual distinction between outbound and inbound

---

### C4 — Staleness banner
To trigger: run any search, wait (or run same search twice — second will be cached).

**Check:**
- If results come from cache (>30 min old): banner appears "Prices from ~X min ago"
- Banner includes a Refresh action
- If results are fresh: no banner shown

Note: hard to test manually without manipulating cache. Check if banner appears on repeated searches.

---

### C5 — Progress bar during search
During any search, watch the progress area.

**Check:**
- A progress indicator appears while searching (not just a spinner)
- Shows how many combos completed vs total (e.g. "12/24")
- Does not freeze or jump backwards
- Disappears cleanly when results arrive

---

### C6 — Share URL
After any search, click the Share button (if present).

**Check:**
- URL changes or a share link is generated
- Opening that link in a new tab: the original prompt is pre-populated
- Submitting the pre-populated prompt runs the same search

**Red flags:**
- Share link only encodes one date (broken for multi-date searches)
- Link opens blank / no prompt pre-filled

---

### C7 — Booking links
On any flight card, click the booking button.

**Check:**
- Opens Skyscanner (or Google Flights) in a new tab
- The destination opened matches the flight on the card (not a generic Skyscanner homepage)
- Label says "Search on Skyscanner" (not "Book" — since it's not a direct booking link)

---

### C8 — Empty results messaging
After B4 (no-route result) or A8 (impossible return date), check the empty state.

**Check:**
- Not just a blank white screen
- Shows a reason: "No flights on this route", "Safety filtered", or "Return date before departure"
- Reason is specific, not generic "Something went wrong"
- Suggests an action: "Try different dates" or "Try nearby airports"

---

## Test Suite D — Edge Cases

### D1 — Very short notice
```
fly from Paris to Berlin today
```
**Check:**
- App handles "today" correctly (correct date, not yesterday/tomorrow)
- If no flights left today: says so clearly, doesn't show past flights
- If flights exist: departure times are in the future relative to now

---

### D2 — Far future date
```
fly from London to Tokyo December 25
```
**Check:**
- Results exist (Google Flights shows future inventory well in advance)
- Prices are shown (not €0 across the board)
- Date correctly parsed as Dec 25 of the upcoming year

---

### D3 — Gibberish / unrecognisable prompt
```
xkcd banana 42 fly somewhere
```
**Check:**
- App does not crash
- Shows a clear error: "Couldn't understand this prompt" or similar
- Does not run a search with garbage parameters

---

### D4 — Same origin and destination
```
fly from Amsterdam to Amsterdam next week
```
**Check:**
- App shows a clear error or zero results with explanation
- Does not run a nonsensical search

---

## How to Record Results

Create `tests/quality/RESULTS-YYYY-MM-DD.md` with:

```markdown
# Test Run — YYYY-MM-DD

Tester: [subagent / human]
App URL: https://sky.buildingopen.org

## Summary
| Suite | Score | Notes |
|-------|-------|-------|
| A — Parsing | X/5 | ... |
| B — Data | X/5 | ... |
| C — UX | X/5 | ... |
| D — Edge | X/5 | ... |
| **Overall** | **X/5** | |

## Test Results

### A1 — Simple one-way
Prompt: `fly from Berlin to Rome next Friday economy`
Score: X/5
Parsed config visible: [screenshot desc]
Issues: ...

[repeat for each test]

## Critical Bugs Found
[List any FAIL results that need immediate fixing]

## Recommendations
[Improvements that aren't bugs but would raise quality]
```
