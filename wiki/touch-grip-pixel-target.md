# Screen-readable banking grips on a zoomed-out mobile coaster

November 18, 2026. A focused direct-manipulation improvement in SomeLimits, the single-file, no-build, NoLimits 1-style editor.

## Reproduced problem

Until this round, the blue banking grip was located **2.6 metres from its selected point in 3D**, regardless of the camera's distance. This works while viewing a point closely, but the mobile **Frame Track** camera fits the entire coaster into a 390×844 viewport.

The browser test imported a deliberately uneven five-node completed loop, then tapped its elevated second point (27 metres high, banked 40 degrees). After raising the point with its orange precision cap, it attempted to grab its blue grip and roll the node toward 120 degrees. The initial real WebGL test failed. The projected numbers revealed why:

- At the existing 2.6m ring radius, the node was at about **(182,270) CSS px** and its grip at **(181,274)**: barely **4 pixels** of separation. The intended 80° roll moved the apparent grip only ~5 pixels. A visible handle is not necessarily a usable touch target.
- The selected point's separate orange cap worked and all other nodes remained untouched, showing this was specific to bank-grip usability at distant viewing.
- The old browser test on a **lone station** passed because its frame was close enough and its special +X tangent made the roll easier to aim. That did not represent real, curved multi-point tracks.

At far zoom the existing touch halos are already scaled by camera distance to maintain a roughly constant hit area, but a larger invisible sphere around the grip does **not** fix a grip whose centre sits almost on top of the point. Enlarging only the invisible target invites ambiguous selection. The blue handle needs to **look** separated as well.

## Decision: scale the editing gizmo, not the coaster

A new pure helper `editGripRadius(n)` chooses the bank-control radius using the current camera on a coarse-pointer device:

```js
if (!COARSE) return 2.6; // desktop unchanged
const distance = camera.position.distanceTo(new THREE.Vector3(n.x, n.h, n.z));
const worldPerCssPx =
  2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
return Math.min(24, Math.max(2.6, worldPerCssPx * 44));
```

The **44 CSS pixels** are a nominal 3D-radius guideline, not a promise that every rolled direction projects to exactly 44 pixels. Perspective, view angle and the track tangent foreshorten some orientations. The real mobile browser test separately measures whether the actual projected grip sits visibly apart from the node.

This radius is used consistently by the selected-point **blue torus, support bar, blue grip sphere, and invisible grip hit proxy at the new position**. It is calculated whenever the selected handle group is rebuilt. The original bank value, its local roll frame, shortest-angle interpolation, auto lift, physics, spline sampling, save JSON, share links, undo/history and the orange cap's position remain unchanged.

There is no new tool, mode, slider, gesture, texture, asset or Three.js dependency. The grip still maps to the same existing `gripBank` pointer path, based on the local roll-plane intersection; it simply has enough on-screen leverage to be aimed at.

- **Desktop mouse:** still has exactly the original 2.6m grip ring.
- **Touch, close-up:** the radius still has a 2.6m lower limit.
- **Touch, zoomed out:** the radius increases with camera distance and is capped at 24m to avoid giant world-space gizmos on pathological camera views.
- **DPI:** CSS pixel sizing depends on `innerHeight`, not the rendering-buffer pixel ratio; a DPR 3 phone still gets the intended apparent size even while the renderer caps raster DPI to 2.

## Verified results from real mobile Chromium WebGL

The game was loaded in Chromium's **390×844 mobile touch context** with a genuine software WebGL scene, pinned Three.js, and CDP `Input.dispatchTouchEvent`. The same five-point coaster, camera, second control point, 40° starting bank and +80° target were reused after the fix.

After raising the point to 47m, the projected grip was:

- Selected node: around **(182,270)**.
- Blue grip: around **(175,290)**; ~21 CSS pixels from the node, instead of ~4.
- Target blue grip: around **(190,314)**; a meaningful ~28-pixel deliberate touch movement rather than ~5.
- 3D radius at that view: **~14.23m**, selected from the actual `editGripRadius()` game source.
- The real canvas reported the **`grabbing`** cursor on touch start: the correct blue grip was selected, not a lime node or orange cap.

The automated browser suite then passed:

1. JSON-import a complete, banked five-point circuit (a real sampled spline, not a single-station fallback).
2. Touch-select elevated **non-station point #2**, confirm its own bank is 40°.
3. Drag its orange cap to raise the point; assert only that node's height changes, four other node objects unchanged, and Undo/Redo exact.
4. Grab its **enlarged blue grip** and drag toward a different roll angle; assert only node #2's bank changes, other four nodes still deeply equal, selected node x/z/h/lift/station untouched, Undo/Redo exact.
5. Continue passing the previously established single-point vertical/sideways drag, first-station precision controls, interrupted-gesture rollback, autosave/draft, support-clearance and classic physics tests.

The successful run logged **`PASS multi-node cap`** and **`PASS multi-node bank`**. A separate, dependency-free test `tests/touch-grip-size-regression.mjs` extracts the actual `editGripRadius()` helper from the production game and guards the original desktop radius, mobile close minimum, ~44 CSS-pixel ideal-world target, far-camera growth, 24m maximum, and consistency of the blue ring/bar/grip geometry.

## Limitations / what to test next

- A ring in 3D can be viewed at a foreshortened angle; this change gives it a more usable mobile radius but doesn't guarantee identical pixel spacing for every 3D roll angle or viewpoint.
- The white/lime node and orange cap still retain their existing geometry and touch halos. If two handles visually overlap at a particular angle, the existing `capGripWinner()` uses projected screen-centre distance to arbitrate them.
- This is **mobile Chromium emulation**, not an iPhone/iPad Safari hardware pass. Verify thumb selection and 3D grip visual size on physical iOS hardware; look for screen-edge clipping on extremely tall coaster layouts.
- A future regression should manipulate a regular lime node in a completed multi-point track, then test undo/redo and exact unchanged neighbor objects. The current five-point browser test verifies cap and blue grip; the earlier standalone point-drag tests cover lone-station plan movement.

## Developer instructions

Run the light source-backed invariant check without dependencies:

```sh
node tests/touch-grip-size-regression.mjs
```

Run full WebGL browser integration as in [Browser smoke](browser-smoke.md); GitHub Actions installs **test-only** Three.js and Playwright, and the actual visitor's game stays one HTML page.

Related: [Editor runtime](editor-runtime.md), [First station precision handles](first-station-precision-handles.md), [Direct point drags](direct-point-drag.md), [Player guide](player-guide.md), [Architecture](code.md).
