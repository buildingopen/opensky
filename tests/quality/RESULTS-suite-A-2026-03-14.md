# Suite A Results — Prompt Parsing Quality
Date: 2026-03-14
App: https://sky.buildingopen.org (tested via local instance at http://localhost:4000 with local API at http://localhost:9100 — remote API was returning 502 Bad Gateway at time of testing)
Tester: Claude Sonnet 4.6
Today's reference date: 2026-03-14 (Saturday)

## Environment Note
The live backend at `opensky-api.buildingopen.org` returned 502 Bad Gateway for all requests during this test session. All tests were run against the same codebase (same Gemini model, same parsing logic, same frontend) running locally. Parsing quality results are equivalent to what would be seen on the live site.

---

| Test | Score | Summary |
|------|-------|---------|
| A1 | 3/5 | Origin/dest correct; date off by 1 day (Sat instead of Fri) |
| A2 | 4/5 | Round trip badge + return date shown; no flight results (provider) |
| A3 | 3/5 | Max price correct; weekend dates off by 1 day (Sat→Mon instead of Sat→Sun) |
| A4 | 5/5 | Both origins shown, destination correct, June dates sampled |
| A5 | 5/5 | "Direct only" chip, FRA→NRT, April dates all correct |
| A6 | 2/5 | Only Caribbean/Americas warm destinations; no Mediterranean or SE Asia; search timeout (60 routes) |
| A7 | 5/5 | Business chip shown, DXB→SIN, next week dates, prices €611–€1810 |
| A8 | 5/5 | Warning "Return date is before or same as departure" shown; one-way search only |
| **Average** | **3.9/5** | |

---

## A1 — Simple one-way
Prompt: `fly from Berlin to Rome next Friday economy`
Score: **3/5**

What I saw:
- Parsed chips: `BER → FCO | Mar 21`
- Origin: BER (correct)
- Destination: FCO (correct — Rome Fiumicino)
- Date: Mar 21 = 2026-03-21 (Saturday). Next Friday from 2026-03-14 is **2026-03-20**, not 2026-03-21.
- Cabin: Not shown as a chip, but Skyscanner and Google Flights booking links use `cabinclass=economy` (correct)
- Round trip indicator: absent (correct for one-way)
- Results: 6 flights found, €151–€369, all BER→FCO

Issues:
- "next Friday" parsed as Saturday March 21 instead of Friday March 20. Gemini appears to be computing "next Friday" from Sunday as the start of week, shifting everything by 1 day. This is a consistent off-by-one error in relative date calculation.
- Cabin class is not rendered as a chip (only visible in booking link parameters). Economy is the default so this is low impact but inconsistent with the A7 test where "Business" does show as a chip.

Screenshot: screenshots/A1.png

---

## A2 — Round trip
Prompt: `round trip Berlin to New York May 10 returning May 20`
Score: **4/5**

What I saw:
- Parsed chips: `BER → JFK | May 10 | Round trip → May 20`
- Round trip badge: visible
- Outbound date: May 10 (correct)
- Return date: May 20 (correct, shown as `→ May 20`)
- Origin: BER (correct)
- Destination: JFK (correct — New York JFK, primary transatlantic hub)
- Results: "No flights found. No flights match this route and date. Try nearby airports or different dates."

Issues:
- No flight results were returned (provider_error). This is a data availability issue, not a parsing issue. May 10 flights for BER→JFK are in the future and may not yet be in the Duffel provider's database.
- The `/api/parse` endpoint independently returned empty `return_dates` for this prompt (non-deterministic Gemini behavior), but the `/api/search` endpoint correctly populated `return_dates: ["2026-05-20"]`. This discrepancy between the two endpoints could cause confusion if the parse endpoint is used independently.

Screenshot: screenshots/A2.png

---

## A3 — Budget constraint
Prompt: `cheapest flights from Madrid to Lisbon this weekend under 80 euros`
Score: **3/5**

What I saw:
- Parsed chips: `MAD → LIS | Mar 15, Mar 16 | Max €80`
- Origin: MAD (correct)
- Destination: LIS (correct)
- Max price: €80 chip shown (correct)
- Dates shown: Mar 15 (Sunday) and Mar 16 (Monday)
- Results: €46 and €68 flights, both under €80 (correct price filtering)

Issues:
- "This weekend" from Saturday March 14 should be March 14 (today, Saturday) and March 15 (Sunday). Instead, Gemini returned March 15 and March 16 (Sunday + Monday). Same off-by-one pattern as A1.
- March 14 (today/Saturday) is missing.
- March 16 (Monday) should not be included — it is not "the weekend."
- The €80 max price constraint is correctly applied: all results were under €80.

Screenshot: screenshots/A3.png

---

## A4 — Multi-origin
Prompt: `fly from London or Amsterdam to Bangkok in June, economy, any stops`
Score: **5/5**

What I saw:
- Parsed chips: `LHR AMS → BKK | Jun 1 +9 more`
- Origins: LHR and AMS both shown as chips (correct — "or" correctly interpreted as multi-origin)
- Destination: BKK (correct)
- June dates: 10 sampled dates (Jun 1, 4, 7, 10, 13, 16, 19, 22, 25, 28 — correct sampling across June)
- Stops: "any" (no stops chip — correct, "any stops" means no restriction)
- Results: 190 flights from both origins shown, including AMS→BKK and LHR→BKK routes

Notes:
- LGW (London Gatwick) not included as a second London origin, but LHR (Heathrow) is the primary London airport for transatlantic/long-haul routes. Acceptable.

Screenshot: screenshots/A4.png

---

## A5 — Stops preference
Prompt: `direct flights only from Frankfurt to Tokyo next month`
Score: **5/5**

What I saw:
- Parsed chips: `FRA → NRT | Apr 1 +4 more | Direct only`
- Origin: FRA (Frankfurt am Main — correct)
- Destination: NRT (Tokyo Narita — correct, one of Tokyo's two main airports)
- Stops chip: "Direct only" shown (correct)
- Dates: April 1, 8, 15, 22, 29 (5 sampled dates across April — correct, next month from March 14)
- Results: 5 direct flights found, all showing "Direct" badge, JAL €1,476 cheapest

Notes:
- All results show "Direct" for the leg, confirming stops filter applied correctly.
- HND (Tokyo Haneda) not included as an alternative Tokyo destination; NRT-only search. Acceptable for FRA→NRT direct routes (most direct flights operate NRT).

Screenshot: screenshots/A5.png

---

## A6 — Anywhere prompt
Prompt: `fly somewhere warm from Paris in March under 300 euros`
Score: **2/5**

What I saw:
- Parsed (from API): `CDG → [MIA, LAX, HNL, SJU, CUN, PUJ, MBJ, BGI, DXB, MRU]`
- Max price: €300 chip shown
- Dates: Mar 15–20 (6 remaining March dates)
- Results: Search timed out after 60 seconds ("Search timed out after 60 seconds. Try a narrower search.")

Issues:
- Destination selection is heavily biased toward Caribbean and Americas (MIA, LAX, HNL, SJU, CUN, PUJ, MBJ, BGI, MRU). Only DXB (Dubai) and sometimes BOM (Mumbai) represent other regions.
- Missing warm destinations that are geographically closer and more realistically under €300 from Paris:
  - Mediterranean: BCN (Barcelona), LIS (Lisbon), AGP (Malaga), PMI (Palma), ATH (Athens), SPU (Split)
  - North Africa: TUN (Tunis), CMN (Casablanca), RAK (Marrakech)
  - Southeast Asia: BKK (Bangkok), SGN (Ho Chi Minh City), SIN (Singapore) — longer but valid
- The 60-route search (10 destinations x 6 dates) consistently times out. The test criterion requires 10–15 warm-weather airports; 10 are provided, but the regional distribution is poor (all Caribbean/long-haul from Paris; not realistic under €300).
- The 60-second client timeout is triggered, leaving the user without any results at all.

Screenshot: screenshots/A6.png (shows timeout message)

---

## A7 — Business class
Prompt: `business class from Dubai to Singapore next week`
Score: **5/5**

What I saw:
- Parsed chips: `DXB → SIN | Mar 16 +6 more | Business`
- Origin: DXB (correct)
- Destination: SIN (correct)
- Cabin chip: "Business" shown (correct)
- Dates: Mar 16, 17, 18, 19, 20, 21, 22 (full next week — correct)
- Results: 16 flights found, €611–€1,810 (correct business class pricing range)
- Skyscanner links use `cabinclass=business` (correct)

No issues found.

Screenshot: screenshots/A7.png

---

## A8 — Impossible return date
Prompt: `fly Berlin to Paris March 20 returning March 15`
Score: **5/5**

What I saw:
- Parsed chips: `BER → CDG | Mar 20`
- Warning message shown: "Return date is before or same as departure — searching one-way only."
- No March 15 return search was performed
- Results: 2 one-way flights found for BER→CDG on Mar 20 (€70–€130)
- No crash, no silent failure

The app correctly detects the logical impossibility (return before departure), shows a clear warning, and falls back to a one-way search. This is excellent UX.

Screenshot: screenshots/A8.png

---

## Critical Issues

### A1/A3 — Consistent off-by-one in relative date calculation (Score impact: -2/5 each)
Both "next Friday" (A1) and "this weekend" (A3) are calculated 1 day late. "Next Friday" from Saturday March 14 was interpreted as March 21 (Saturday) instead of March 20 (Friday). "This weekend" was interpreted as March 15–16 (Sunday–Monday) instead of March 14–15 (Saturday–Sunday). This is a systematic Gemini prompt issue. Gemini appears to be treating the first day of the week as Monday, shifting all "next weekday" calculations by one day.

### A6 — Warm destination bias and search timeout (Score impact: -3/5)
The "fly somewhere warm" query produces only Caribbean/Americas destinations, missing the more geographically and price-appropriate Mediterranean (Malaga, Palma, Athens, Lisbon) and North Africa (Marrakech, Tunis) options that would be realistically under €300 from Paris. Additionally, the 10-destination x 6-date = 60-route search always times out in the 60-second client window, leaving the user with zero results. The parser should either cap destinations at 5–6 for inspirational searches, or the system should show partial results before timeout.

### A2 — Parse/search endpoint inconsistency for return_dates
The `/api/parse` endpoint returned empty `return_dates` for the round-trip prompt, while `/api/search` correctly returned `return_dates: ["2026-05-20"]`. This non-deterministic behavior means callers of `/api/parse` may get incorrect results. Not critical for the current UI (which uses `/api/search`), but worth fixing for API consistency.
