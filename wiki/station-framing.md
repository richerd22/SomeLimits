# Camera framing when only a station exists

Updated November 18, 2026. No new editor controls.

## Why this matters

Starting from a blank plot is the central SomeLimits experience. After a station is placed, the editor has one node but **no open track spline yet**; `buildLoneStation()` intentionally leaves `track = null`.

The old `frameTrack()` immediately returned when `track` was null, so the **Frame Track** button did nothing. The old `framePlot()` always focused on the world origin `(0,2,0)`. A lone station imported from a draft or recovered from autosave could sit far across the build plot (e.g., x=-111, z=93), outside that default view. The player would have a coaster to continue but no obvious way to find its only point.

## Decision

- `frameTrack()` now falls back to `framePlot()` when there is no sampled track.
- A pure `plotFrameTarget(nodes)` helper returns `(0,2,0)` for an empty plot, preserving the old familiar eye exactly.
- For a **single station node**, it returns that node's x/z and height (with y at least 2m), so `framePlot()` positions the camera at the same 52m/44m/74m three-quarter offset relative to the actual station, then sets OrbitControls' target on that station.
- Normal tracks with two or more open nodes or completed loops still use the original `frameTrack()` track-bounds framing. No ride geometry, physics, banking or saved node values move.
- No new mode or button. **Frame Track** now works while placing the first station; a restored draft with one point is immediately findable.

## Source-backed test

```sh
node tests/station-framing-regression.mjs
```

The regression extracts the exact `plotFrameTarget`, `framePlot` and `frameTrack` functions from `play/index.html`. It verifies the original blank camera `(52,46,74)` and target `(0,2,0)` remain unchanged; a single distant station at `(-111,46,93)` becomes the orbit target; a low 1m station has a safe y=2 target; camera target updates are called once; framing does not mutate node coordinates, bank or station flags; and the Frame Track function actually calls the fallback when `track === null`.

The test joins the existing editor, draft, physics, support-clearance and actual Chromium browser checks in GitHub Actions. Physics baseline remains the current provisional **44.4s / 86 km/h** on classic.

## Manual verification

- [ ] Start from an empty plot: initial camera is the normal three-quarter grid view.
- [ ] Place one station far from the center. Pan away, press **Frame Track**. The station should return to the center of the view.
- [ ] Export the one-point draft, refresh or import it, and press Frame Track. The imported station should appear without guessing where it was.
- [ ] Add a second point: Frame Track should now fit the actual open spline, rather than the single-node fallback.
- [ ] Complete a circuit: Frame Track should keep its existing complete-coaster bounds fit.
- [ ] Check on a tall portrait touchscreen that the point is visible and tappable after import.

No AI-generated imagery or separate camera-mode taxonomy was added. This is a small repair to an existing button that was previously inert in an important state.

Related: [Draft rescue](draft-rescue.md), [Player guide](player-guide.md), [Browser smoke](browser-smoke.md), [Architecture](code.md).
