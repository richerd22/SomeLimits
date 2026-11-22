# Round 32 — actual linked 2D drafting alongside the live 3D coaster

## Why this exists

The original SomeLimits editing problem was not simply unreliable selection: a user finishing a lift hill had to repeatedly swap cameras to create a crest, turn and drop. Round 25–31 added proper TOP/SIDE/FRONT projections, direct placement, snapping, exact curve previews and configurable quick sections—but **only one viewport was visible at a time**. Classic NoLimits-style editing is much easier when a 2D sketch stays visible while inspecting the same track in 3D.

## New capability — shared-source simultaneous editing

- A secondary, resizable-by-CSS **Canvas2D drawing pane** overlays the bottom-right of the main Three.js viewport. The primary view can remain **3D** while the secondary switches among **TOP, SIDE, FRONT**.
- The secondary pane draws the **actual already-sampled track curve**, source control nodes, station and selected-point highlight with a 5/10/25m drafting grid. It uses the identical node array, selection index, and Undo history as the existing editor. No extra 3D scene, WebGL context, terrain, physics engine, rail/support rebuild on painting, or generated textures.
- **Tap a node** to select it in both the 2D and 3D views. **Drag a node** to change the plane's two visible axes while preserving the hidden axis and existing bank/lift/station flags. SIDE edits X/height; FRONT edits Z/height; TOP edits X/Z at constant height. A complete gesture makes **one existing Undo/Redo transaction**. A pointercancel returns the original values without committing.
- **Tap empty drafting paper** while building an open track to extend from its current endpoint. SIDE or FRONT can create an actual uphill or downhill segment directly, preserving the endpoint's hidden axis and banking. TOP can also place the first station on blank paper or extend at the current height.
- **Drag empty paper** to pan without creating nodes, or use **mouse wheel/±** for anchored zoom and **FIT** to frame the current track. TOP/SIDE/FRONT each retain independent pan/zoom and reset after a new/imported coaster.
- The pane's heading has TOP/SIDE/FRONT + zoom/FIT/close buttons; a **Linked 2D pane** toggle lives in the main foldable inspector, with keyboard J. It defaults **visible on roomy desktop widths (1200px+)** and **hidden on mobile**. This prevents another floating dock from covering the original lime/orange/blue mobile precision handles.
- Ride mode automatically hides the linked pane and returning to editing restores it if it was previously enabled.

## Architectural implementation

One new plain ECMAScript module: `play/linked-drafter.js`. No bundler, code-generated textures, external scripts or runtime dependencies. The module provides pure and independently testable `planePoint`, `fromPlane`, `fitLinkedView`, `planeToCanvas` and `canvasToPlane` functions and the lightweight `createLinkedDrafter` view/controller. The main `play/index.html` configures its callbacks; the linked pane never directly invokes the coaster physics code.

The persistent document remains the original `{nodes, building, name}`, exactly as before. Only the Boolean editor preference for showing the pane is stored separately as `somelimits-linked-drafter-visible-v1`. Closing the pane/playing the ride does not change the track or save snapshots. Existing source node edit callbacks enqueue the original one-per-frame WebGL preview; the linked Canvas2D itself does not rebuild rails.

## Tests

- `tests/linked-drafter-regression.mjs` checks pure projection axes in TOP/SIDE/FRONT (including `THREE.Vector3.y` sampled-curve heights), hidden-coordinate preservation, 1m/5m optional snap, bounds, pixel-to-world roundtrip, station/chain immutability and framing an 80-node coaster.
- `tests/browser-smoke.mjs` uses the actual desktop Chromium WebGL editor with the 3D camera active and the linked SIDE pane open: it drags a real station point X/height and verifies hidden Z, bank and station are unchanged; runs exact Undo/Redo; then FRONT drag changes Z while preserving X and height. It taps empty SIDE paper to append a new uphill section, Undo removes it exactly, tests close/reopen, and asserts no errors. Separate simulated 390px mobile acceptance verifies the pane defaults hidden and retains existing thumb targets.
- The full existing exact physics presets, 80-node performance, touch banking/cap, large terrain/collision, ride insights, autosave, station recovery and WebGL browser acceptance remain required.

## Known limitations

This is a **first linked orthographic drafting pane**, not a full resizable four-pane docking system. It does not have Bezier/tangent editing, multi-select, iOS physical-device certification, or native NoLimits project import. Mobile users can explicitly open the mini-pane, but hardware iOS Safari behavior still needs acceptance before any claim of certification. The plain ES module and original game remain without a build step.

## Source links

- [PR #33](https://github.com/richerd22/SomeLimits/pull/33)
- [Linked 2D module](https://github.com/richerd22/SomeLimits/blob/main/play/linked-drafter.js)
- [Production editor integration](https://github.com/richerd22/SomeLimits/blob/main/play/index.html)
- [Source geometry regression](https://github.com/richerd22/SomeLimits/blob/main/tests/linked-drafter-regression.mjs)
- [Real desktop/mobile WebGL acceptance](https://github.com/richerd22/SomeLimits/blob/main/tests/browser-smoke.mjs)
