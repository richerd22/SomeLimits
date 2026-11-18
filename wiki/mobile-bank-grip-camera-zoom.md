# Camera-continuous mobile bank grip: visible circle and hit target follow zoom

November 18, 2026. A focused usability and rendering-state repair in the single-file SomeLimits browser editor.

## Problem

The previous [screen-readable mobile bank grip](touch-grip-pixel-target.md) fix chose its world-space radius from the camera's distance at the moment the selected-point gizmo was **constructed**. This protected the player when they first framed a completed track: the grip was no longer 4 CSS pixels from its point.

But the player may then **orbit, pan or zoom** using OrbitControls without changing the coaster data. The selected point's gizmo did not rebuild on camera motion, and its original world-space radius was frozen. An easy-to-grab blue bank control could shrink back toward its lime point when the camera moved farther away, or become visually huge when the camera came closer. Merely enlarging the invisible hit sphere wouldn't correct its visual leverage or the precise location of the clickable blue ball.

Re-running the full `buildTrack()` after every camera movement would be a disproportionate fix: it re-samples 900+ spline positions and regenerates rail, tie, support and terrain-related geometry, churning WebGL allocations in the exact mobile interaction path we are trying to improve.

## Design decision

Keep the **same** source-backed `editGripRadius(n)` model: touch devices aim for about a 44 CSS pixel 3D roll radius, subject to minimum 2.6m / maximum 24m world-space bounds. Desktop retains its 2.6m radius. Only improve *when* we apply it.

On building a selected node's bank control:
- `buildSelectedEditHandles()` records references to the existing blue torus, bar, blue sphere and coarse-pointer hit proxy in `handleGroup.userData.touchBankGizmo`. It also records the node's roll direction, origin, originally built radius, last applied radius, camera position and CSS viewport height.
- `addHitProxy()` now returns the proxy it already created; existing callers may ignore the return value, preserving their behavior. The blue grip's caller stores that object instead of allocating a duplicate halo.
- No new scene graph group, mode, button, saved field or asset is created.

Once each frame, **after** OrbitControls applies its damping:
- `refreshTouchBankGizmo()` skips on desktop, during ride mode and while any point/bank/cap edit is active. A camera that has not moved by a meaningful threshold, with unchanged viewport height, takes an immediate cheap no-op path.
- If the camera has moved, it recomputes the desired bank radius. An insignificant radius change is ignored.
- It scales the **existing** torus in its local XY roll plane, extends the **existing** bar along local Y, moves the original blue sphere along the stored point-local roll direction, and moves/resizes the **same invisible hit proxy** to match the visible grip.
- This is a mesh transform update, **not** a track geometry rebuild. The rail, station, supports, terrain, physics, bank values and save format do not move.

## Source-backed verification

`tests/touch-grip-camera-regression.mjs` extracts the actual production `editGripRadius()` and `refreshTouchBankGizmo()` functions out of `play/index.html`. The test uses pinned real Three.js vectors and a perspective camera with a test mobile viewport.

The test locks:
- Zooming out enlarges the blue ring radius using the existing camera math.
- The ring, bar, blue grip and hit proxy all move consistently and keep their **same object identities** (no GPU geometry allocation/disposal in response to camera motion).
- The proxy continues to match the visible ball rather than becoming a stale invisible click target.
- A stationary camera is a no-op.
- Zooming back in decreases the radius as expected.
- Editor control updates do not run during an active point drag, in ride mode, or on desktop.
- Changing viewport height triggers a refresh even if the camera didn't move.
- The actual animation loop calls the refresh **after** `controls.update()`.
- The camera refresh function never invokes `buildTrack()`.

Run after installing the test-only pinned Three.js library:

```sh
npm install --no-save --no-package-lock three@0.160.0
node tests/touch-grip-camera-regression.mjs
```

GitHub Actions runs this alongside the prior touch radius invariant, full browser WebGL smoke on first station and five-point completed coaster, draft/autosave/collision, and all four exact physics snapshots.

## Manual device acceptance

- [ ] On an iPhone, tap a banked non-station node, pinch the camera away and toward it. The blue bank ring must remain comfortably separated from the lime point; its clickable blue ball should agree with what is drawn.
- [ ] Orbit the camera through bank ring foreshortening and verify no sudden snap, inconsistent cursor or oversized grip.
- [ ] With the blue bank grip **held**, the camera must remain locked and the edit gesture must not be retargeted mid-drag.
- [ ] Release, zoom, and grab again; verify bank changes only on the selected point and Undo/Redo remain exact.
- [ ] On desktop mouse, the ring stays at the original fixed 2.6m physical radius, regardless of camera zoom.
- [ ] Resize or rotate a phone; the ring should follow the changed CSS viewport without excessive GPU allocations.
- [ ] Profile actual iOS Safari FPS, battery/heat and memory with 5/15/30 nodes. Chromium mobile emulation cannot prove physical Apple hardware performance.

## Limits and further opportunities

The target 44 CSS pixels is an **ideal 3D radius** derived from camera distance and perspective FOV. Its on-screen projection still depends on view angle: an edge-on roll plane can foreshorten the circle and bring controls closer. The existing [extreme banking touch ownership](extreme-bank-touch-arbitration.md) checks -90/-80/+90 at a known mobile fit-camera pose; more freely orbited angles and real Safari hardware remain valuable acceptance work.

No changes to coaster physics, node interpolation, station rules, speed floors, JSON/share schema, runtime dependency or NoLimits 1-style simple interaction model.

Related: [Mobile touch size](touch-grip-pixel-target.md), [Extreme bank picking](extreme-bank-touch-arbitration.md), [Editor runtime and GPU disposal](editor-runtime.md), [Browser smoke](browser-smoke.md), [Developer guide](dev.md).
