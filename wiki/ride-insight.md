# Ride insight: tell the builder what the simulator actually did

Updated November 18, 2026. This is a behavior and diagnostics improvement, not a change in the physics model or a real-world safety certification.

## What was missing

SomeLimits has a longstanding **1.2 m/s minimum-speed guard** in `stepRide()`, which keeps the train moving when a difficult section would otherwise crawl. That is a reasonable approachable-game design choice, but the previous **Lap Complete** screen reported time, max speed and G forces without mentioning that an unpowered section might have needed a simulation assist. A player could spend ages adjusting a second hill, get the train home, and learn nothing about why that climb felt weak.

A separate bug: the HUD's **Restart Lap** and the results screen's **Ride Again** reset the train state but did not clear `gHist`. The live G-force graph retained samples from the prior lap and could visually compare two unrelated rides as if they were one continuous run.

## Decision: real observations, no new mode

The 1.2 m/s guard **still exists and works the same way**. The integrator, chain speed, tire speed, braking, and train geometry are unchanged.

For every physics substep after the initial 8m dispatch section:

- If the train drops below 1.2 m/s on a mid-course section **outside station brakes, intentional flat-tire drive and active uphill chains**, `stepRide()` increments `ride.assistSeconds` by the real substep duration and records `ride.firstAssistM` at the first intervention.
- For eligible unpowered/unbraked sections it tracks `ride.slowestCruiseV` and `ride.slowestCruiseM`.
- It does not alter acceleration, position, speed floor, force calculations or save data to collect these metrics.

A pure `lapInsight(ride)` creates a short plain-language note displayed **under the existing lap summary**, not in a new setup panel:

1. If the minimum-speed floor was needed for at least 0.25 seconds, report the duration and first approximate metre along the lap. Suggest lowering a difficult next hill or changing the climb to 8m or more between nodes so the existing automatic chain picks it up.
2. Otherwise, if a *brief* assist was recorded (<0.25 seconds), say that it happened and where. Never call an actually rescued ride unassisted just because it was below the stronger warning threshold.
3. Otherwise, if unpowered non-braking speed dropped below 3.0 m/s (about 11 km/h), report the slow spot's speed and approximate distance from the station.
4. Otherwise state that no minimum-speed rescue was needed and explicitly remind the builder that these are simplified game physics, **not a real-world safety check**.

No prediction is calculated from a theoretical drop; the note comes from the completed integrated ride. The 0.25s threshold avoids reporting a one-frame numerical blip as the central ride result.

## Lap resets must be clean

`resetLapState()` now creates a new `ride`, resets `lapShown`, and clears `gHist`. The existing **RIDE IT**, **Restart Lap** and **Ride Again** flows all call it. A fresh graph shows only the current ride; no new controls or settings are added.

## Verification

Run the source-backed regression after installing the test-only pinned Three.js library:

```sh
npm install --no-save --no-package-lock three@0.160.0
node tests/ride-insight-regression.mjs
```

The test extracts the exact `computeTrack`, `createRide`, `stepRide`, and `lapInsight` functions from `play/index.html`. It verifies:

- A clean ride starts with no artificial assists recorded.
- Truly flat circuits powered by tires are **not falsely reported as unpowered speed rescues**.
- Deliberately slowing the train to near zero on a real sampled, non-braking unpowered section triggers assist seconds and the correct first-distance marker. Even a brief actual assist is reported honestly; a longer assist gets the more detailed warning.
- A slow section that did not need an assist gets a distinct message from one that did.
- The classic preset still finishes at **27.45 s / 88 km/h** under fixed 1/60s steps.
- The actual `resetLapState()` clears a previous ride's G history and resets lap state; both restart controls are wired to it.

The existing GitHub Actions suite also runs the physics/share regression, post-clearance equivalence, point drag, draft rescue, library memory and headless Chromium smoke checks before merging.

## What to test in a browser

- [ ] Ride all four presets. The lap results show a note and their existing data columns.
- [ ] Make a coaster with a tall, *unpowered* uphill after a fast drop. If the minimum-speed guard intervenes, the result should say so and give an approximate distance.
- [ ] Make an intentionally flat circuit. It should ride on tires and **not** be falsely called an artificial-speed rescue.
- [ ] Ride partway through, click **Restart Lap**, and verify the G trace starts clean.
- [ ] Finish a lap, click **Ride Again**, and verify the new lap's G graph and numbers start clean.
- [ ] Verify the result note is readable in a portrait phone viewport, including under normal low-height/high-contrast accessibility settings.
- [ ] Verify the classic preset still reports the expected time and maximum speed.

## Limits and further opportunities

- The game does not calculate real-world coaster forces for structural design, restraint design, certifications, minimum curvature, comfort standards or actual safety. It should never imply it does.
- Distance is **travelled distance along the course** from the station, not a node ID; one note per lap intentionally avoids turning the results into an engineering diagnostic dashboard.
- The speed floor remains deliberately game-like. A future design discussion could change it, but that would alter measured ride fingerprints and require explicit playtesting and test updates.
- Physical iOS Safari responsiveness still requires device testing. Chromium's emulation cannot prove every Apple pointer/gesture scenario.

See [Physics and state architecture](code.md), [Player guide](player-guide.md), [Dev tests](dev.md) and [original lift playtest report](../playtest-2026-11-18.md).
