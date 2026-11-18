# Direct lime-point manipulation on a completed, banked coaster

November 18, 2026. This regression extends the editor acceptance test beyond the selected station and beyond the precision cap/grip.

## Why this test matters

The simple SomeLimits contract is: click or tap a lime point and **drag the point itself**. Sideways drags should change only x/z; clear screen-up drags should change only height. The point's banking is local, and **no neighboring control point may shift on release**. An earlier source-backed test confirmed `setNodePlanPosition()` respects these rules, and mobile Chromium verified them on a **single station**.

A complete coaster is materially different. Its selected non-station point may be high in the air, the camera may be zoomed out to fit the entire track, its tangent/roll frame is curved, and the orange height-cap and blue bank-grip touch halos may overlap the node. A helper-only test cannot prove that a finger actually selects the correct object or that the camera-facing vertical and ground drag planes work in that view.

## Browser scenario

**CI proof:** the full PR integration reported `PASS multi-node direct sideways lime drag` and `PASS multi-node direct upward lime drag` with no game-code modifications. The first version of the test failed only because it prematurely expected a `move` cursor on pointerdown; after correcting the expectation to check the first movement, the actual browser tests passed.

The full real-WebGL `tests/browser-smoke.mjs` test imports a deterministic five-point coaster with varied bank values and an elevated **second node** that is not the station. The five-point integration already verifies its orange cap and blue bank grip. This extension then:

1. Reframe the coaster with the real **Frame Track** camera, and compute the elevated lime node's projected screen coordinates through the same spline-bounds and Three.js camera geometry used for the cap/grip test.
2. Start a low-level CDP `Input.dispatchTouchEvent` finger press exactly at the lime node center, not on the cap or grip. Reject unexpected grabbing or orange-cap cursor ownership. **Node pointerdown normally leaves the cursor neutral until the first pointermove decides axis intent**; the first version of this regression incorrectly expected `cursor:move` at pointerdown and was corrected before release.
3. Drag approximately 86 CSS pixels **sideways** (only 1px vertically). Require the active cursor to become `move`. Check the saved node's ground x/z changed, but its height, bank, station/lift flags and all other four node objects remain unchanged. Undo/Redo must restore the exact old/new x/z.
4. Reframe the edited layout. Start a second genuine touch at the same lime node's newly projected center. Move approximately 90 CSS pixels **up** (only 1px sideways). Require the cursor to choose `ns-resize`, the saved height to rise, unchanged x/z/bank/station/lift and unchanged four other node objects. Undo/Redo exact.
5. Verify no JavaScript runtime errors; run the previous blank, first-station, multisensor, interruption, draft, physics, collision and mobile rendering tests in the same CI workflow.

The test reads production JSON state from localStorage **after** each successful pointer release. Live uncommitted drag values are in memory and the DOM; they must not be expected in localStorage before commit. A canceled gesture should never be mistaken for a successful edit.

## No product-mode expansion

This is targeted input regression coverage, not an additional editor mode, generated visual, new roll-node object or user-facing diagnostic panel. If the browser shows the node can be stolen by cap/grip halos, fix the actual picking/aim arbitration with the smallest bounded change and preserve all existing handle-specific gestures. No change to track physics, preset fingerprints, JSON schema or build step is intended.

## Limits

- The simulated 390x844 mobile Chromium context sends real browser touch events and renders actual Three.js/WebGL. It does **not** constitute a physical iOS Safari test.
- The test's exact five-node shape proves a difficult non-station case, not every possible roll/terrain/camera arrangement.
- Further high-risk cases: banking near +/-90 degrees when blue grip and orange cap centres overlap, far-zoom point selection on lower-end hardware and multi-finger OS gesture interruptions.

Related: [Real browser smoke](browser-smoke.md), [Direct point contract](direct-point-drag.md), [Mobile grip radius](touch-grip-pixel-target.md), [Touch interruption rollback](interruptions-and-touch-regression.md).
