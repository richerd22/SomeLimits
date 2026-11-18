# Precision handles should work on the very first station

Updated November 18, 2026. Scope: the smallest editable coaster—a single station on a blank plot. No new editor mode or geometry asset.

## User-facing inconsistency

The blank-plot editor intentionally starts with zero nodes. A ground tap places a single lime station node, and the game deliberately does **not** invent a track spline until the second point exists.

The original `buildLoneStation()` drew the platform and the lime dot only. The orange precision-height cap and blue banking grip were created **exclusively in the full `buildTrack()` renderer**. The field manual told players to use those handles, but a builder who had just placed their first station couldn't see or grab them until they added another node.

That is a particularly poor first impression for a point-driven editor. The very first point should obey the same direct-manipulation gestures as every point that follows. The precision controls must not depend on having a rideable track.

## Implementation decision

1. Extract the complete, **unchanged** selected-point visual kit—ground pole, footprint ring, orange height cap and blue roll grip—into a single `buildSelectedEditHandles()` function.
2. Call it from both the original full `buildTrack()` path and `buildLoneStation()` after adding the lime dot.
3. The orange cap still lives at the selected point's `(x, h+2.4, z)` and writes to the same local height scalar. Its invisible thumb halo still uses `addHitProxy(...,'cap',...)` with the exact `heightNode` userData as the full track.
4. The blue grip sits on the selected node's local roll plane, writes the same point-local `bank`, and uses the same `bankNode` halo. The original desktop radius is **2.6m**; a later [touch-grip usability repair](touch-grip-pixel-target.md) scales this visual roll gizmo with camera distance on touch devices so it remains aimable when zoomed out. For a one-node layout, `nodeRollFrame()` defines a +X tangent fallback when adjacent points coincide. This produces a stable up/side roll frame with no synthetic second point, spline or ride physics.
5. The library, save schema, history, gizmo arbitration, camera and touch slop retain the existing implementation. Rendering two copies of the same kit is explicitly avoided—the selected handle geometry is generated once per rebuild and released through `disposeEditGroup()` as before.

The blank plot still has **zero handles**; the first station has one lime dot **plus the orange/blue kit**; later open/closed coasters keep their established behavior.

### Follow-up: the floating number must also work before a spline

The handle geometry fix exposed a separate render-loop guard: the height/bank label was only drawn when `track` existed. A one-station draft has `track === null` by design, so its newly available cap and grip worked but **the nearby live number stayed invisible**. The follow-up removes only that `track` condition. The real prerequisite is `mode === 'edit'`, an existing selected node, and no open overlay. An empty plot still shows no label; the first station immediately shows its height, moves its height readout live with the orange cap, switches to live blue banking degrees during a grip drag, and returns to height on release. The underlying height and bank controls/physics never changed. **During a drag, the label and panel input reflect the live in-memory value; localStorage remains deliberately unchanged until pointerup commits.** The browser regression asserts both: live height/bank feedback *while the finger is down* and unmodified persistent saved data until the gesture successfully releases. This also protects cancellation semantics if a finger is interrupted.

## Automated browser verification

The headless Chromium test loads the unchanged game in a simulated 390×844 touchscreen with deviceScaleFactor 3 and actual software WebGL. After placing one station, it:

- Uses the actual **Frame Track** button to center that node at a known camera offset.
- Calculates the projected on-screen positions of its real orange cap and bank grip with the same pinned Three.js `PerspectiveCamera` mathematics (62° FOV and the familiar +52/+44/+74 framing offset). No mock editor API is injected into the production HTML.
- Sends **real browser touch events** to the orange cap's projected pixel, drags vertically, and confirms the actual autosaved node height increases while x/z/bank stay exact. Undo and Redo must reproduce the original and new heights. A follow-up test additionally checks that the floating height readout is visible **during** the drag, not just after it.
- Starts a second touch on the blue grip and moves it around the bank roll ring toward +90°. The actual saved banking must change while height and x/z remain untouched. Undo and Redo must return exactly to the original and new banking numbers. A follow-up checks the floating label reads the **exact current bank degrees** during the grip drag, then returns to height on release.
- Keeps the existing point vertical/sideways drag, two-finger interruption, blur/capture loss and draft export/import smoke tests.

This is integration coverage, not just a source-extracted math test; if either precision handle disappears on the lone node, the corresponding real touch test will fail.

## Manual acceptance on hardware

- [ ] New coaster, one ground tap: orange cap and blue bank grip appear immediately above/around the station.
- [ ] Drag the cap up: station gets taller without moving on the ground. Drag it down and verify it follows.
- [ ] Drag the blue grip around the station: bank rotates visibly and the point doesn't move or change height.
- [ ] Undo and Redo both kinds of gesture. Export a one-station JSON draft and import it; handles must reappear at the exact saved values.
- [ ] Add a second point: the same cap/grip kit remains and continues to behave identically.
- [ ] Check actual iPhone/iPad Safari: the grips are tappable at normal portrait distance and do not accidentally trigger OrbitControls.

## Extreme bank halo overlap: measured browser follow-up

The orange cap and blue grip can lie in overlapping touch halos when banking approaches -90 degrees. A later [real browser overlap regression](extreme-bank-touch-arbitration.md) sets bank to -90, -80 and +90 through the actual slider, taps the projected orange cap, blue grip and lime node separately, and proves the intended input ownership at all angles, with no false saved edit. At the tested 390x844 phone frame, the cap-grip separation was roughly 26, 28 and 54 CSS pixels respectively. This is a **tested camera pose**, not a guarantee for all device angles or physical Safari hardware.

## Limits / next steps

- A lone station can bank before it has a track, but a **ride** still requires a circuit with at least four points. There is no physics/ride requirement for the roll grip to render.
- At extreme bank angles, the blue roll grip may visually approach the orange cap. The prior screen-space `capGripWinner()` arbitration remains responsible for those overlaps; real hardware testing can further refine it if needed.
- Chromium touch emulation cannot establish physical iOS Safari pointer behavior, GPU frame times or device battery draw.

Related: [Browser smoke](browser-smoke.md), [Station framing](station-framing.md), [Direct point drags](direct-point-drag.md), [Player guide](player-guide.md), [Editor runtime](editor-runtime.md).
