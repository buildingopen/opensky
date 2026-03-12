# Launch Readiness Plan

## Goal

Move `opensky` from the current audited state of `55/100` to a public-launch-ready `100/100`, with a repo surface strong enough to earn repeat shares, stars, and installs.

## What Blocks 100 Today

1. The product claim is broader than the implementation.
   The repo currently flags risky airports and countries in the itinerary. It does not analyze actual overflight paths or FIR closures.
2. The public install story is broken.
   `pip install skyroute` does not resolve today, and package metadata still points at the old repo.
3. Provider failures are not surfaced honestly.
   A provider outage can look like `No flights found.` instead of an operational error.
4. The config surface has dead fields.
   `final_destination` is documented but not used in scoring.
5. The repo lacks launch automation.
   There is no CI workflow or release/publish workflow in the repository.

## Success Criteria

The repo reaches `100/100` only when all of the following are true:

- A fresh user can clone, install, run, and verify the project from the README without guesswork.
- The README promise matches the real implementation exactly.
- Search failures are reported as failures, not as empty results.
- The config and CLI surface contain no dead or misleading options.
- CI runs build and tests automatically on supported Python versions.
- A release workflow exists for publishing artifacts and package releases.
- The repo includes one clear, memorable demo path that makes the value obvious in under one minute.

## Plan

### Phase 1: Truth and Trust

- [ ] Rewrite the README headline, problem statement, and safety section so they describe the current engine precisely.
- [ ] Decide the long-term product line:
  - `Truth-first v1`: keep airport/country risk flagging and market it honestly.
  - `Full moat v2`: implement FIR and overflight-path analysis, then restore the broader airspace-closure claim.
- [ ] Remove or replace any wording that implies current overflight analysis before that feature exists.
- [ ] Add a short "What the engine evaluates today" section to the README.

### Phase 2: Honest Runtime Behavior

- [ ] Track provider successes and failures inside the search engine.
- [ ] Return a non-zero exit and an explicit operational error when every provider fails.
- [ ] Print a partial-results warning when one provider fails but another succeeds.
- [ ] Add tests for:
  - all providers failing
  - one provider failing with partial results
  - scan mode provider failure reporting

### Phase 3: Clean Public Surface

- [ ] Remove `final_destination` from the documented config surface or wire it into scoring for real.
- [ ] Validate user-facing config values more aggressively:
  - invalid `stops`
  - invalid `cabin`
  - invalid `risk_threshold`
  - date ranges where `start > end`
- [ ] Align package metadata, clone URLs, and data-update URLs with the current GitHub repo.
- [ ] Replace the broken `pip install skyroute` instruction with an install path that works today.

### Phase 4: CI and Release Automation

- [ ] Add GitHub Actions CI for:
  - build
  - tests
  - Python `3.11`, `3.12`, `3.13`, `3.14`
- [ ] Add a release workflow that builds artifacts on tags and publishes them.
- [ ] Add a smoke check job that runs:
  - `skyroute --version`
  - `skyroute demo --json`
  - `skyroute zones`
- [ ] Document the release process in the repo.

### Phase 5: Viral Repo Surface

- [ ] Put a one-command "wow" path near the top of the README.
- [ ] Add a demo section showing:
  - a risky itinerary being flagged
  - a safe alternative surfacing in the same search
- [ ] Add screenshots or terminal captures for the main flows:
  - `demo`
  - `zones`
  - one live search example
- [ ] Add badges for CI and release health once workflows exist.
- [ ] Add contributor guidance:
  - local setup
  - test command
  - release command

### Phase 6: Full Moat Path

- [ ] Decide whether this repo wins by being:
  - the best honest itinerary-risk CLI
  - or the first credible open-source airspace-risk flight finder
- [ ] If the goal is the second option, build:
  - FIR/airspace geometry support
  - route-path or corridor analysis
  - tests with known risky overflight cases
  - a public methodology section explaining exactly how risk is computed

## Score Milestones

- `70/100`: docs and metadata are honest, install docs work, dead config surface removed.
- `80/100`: provider failures are surfaced correctly and covered by tests.
- `90/100`: CI and release workflows are live, README has a zero-confusion install and demo path.
- `100/100`: the claim, implementation, automation, and public verification are fully aligned.

## Verification Gates

Each phase is complete only when these checks pass:

- `python -m build`
- `pytest`
- installed CLI smoke checks from a fresh virtualenv
- README commands copied verbatim on a clean machine
- `git status --short` is clean after verification

## Recommended Execution Order

1. Truth and Trust
2. Honest Runtime Behavior
3. Clean Public Surface
4. CI and Release Automation
5. Viral Repo Surface
6. Full Moat Path

## First Shipping Slice

If the goal is the fastest credible public launch, ship this slice first:

- honest README
- fixed provider-failure semantics
- cleaned config surface
- current-repo metadata
- CI workflow
- release workflow

That slice removes the trust debt and gives the repo a clean public baseline. The FIR/overflight engine can then land as the feature that pushes the repo from credible to category-defining.
