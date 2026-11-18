# Round 28 — direct elevation drawing and predictable drafting cameras

## User problem
Round 25 added TOP/SIDE/FRONT/3D orthographic tools, and Rounds 26–27 improved their graph paper, gestures and precision. But SIDE and FRONT were still *edit-only*: an empty-space tap could extend track only through a downward ray against the horizontal ground, which is nearly parallel to both elevation cameras. Building a lifted crest then a drop required switching back to TOP, placing a new point at the old elevation, switching back and dragging it down. The user's original lift–turn–drop frustration remained.

## Design decision
An open coaster's endpoint anchors a **2D construction plane** in SIDE or FRONT. Tap empty paper to add a new point directly in that plane. The click controls only the axes you can see:

- SIDE camera looks along −Z. Click determines X and H, while Z is inherited from the previous endpoint.
- FRONT camera looks along −X. Click determines Z and H, while X is inherited from the previous endpoint.
- Both preserve the previous point's bank and the rest of the ordered node document. Values round to 0.1m and clamp to the established ±150m plan and 1–80m height bounds.
- Reject near-duplicate points and exact existing-space overlaps. A tap is distinguished from a pan by the existing mouse/pen/touch dead zones and pointer ownership.
- A blank drawing still begins with a station in TOP; SIDE/FRONT explain that prerequisite rather than inventing a station at an arbitrary height.
- Closed circuits still require the existing insertion workflow; elevation taps only append when the coaster is explicitly **building**.

## Live, allocation-stable preview
On hover in SIDE/FRONT, a lime line runs from the current endpoint to the candidate, with a lime ghost sphere. These are **two persistent objects**: one dynamic 6-float line attribute and one reused sphere. Mouse movement changes only those existing positions. It does **not** sample a new spline, rebuild rails/supports, write autosave, or commit a history edit. The preview hides on drag, view change, cancellation, invalid candidate, closed circuit and ride.

## Camera navigation
- **Zoom − / FIT / Zoom +** are explicit view controls that do not depend on mouse wheel or the collapsed mobile inspector.
- Orthographic mouse wheel/pinch zooms centered on its current drawing instead of zoom-to-cursor drifting the framing unexpectedly; orbit behavior remains unchanged in 3D.
- TOP, SIDE and FRONT retain **separate ephemeral target, position, up-axis, zoom and orthographic frustum size** when switching between views. Re-selecting the current view is a no-op. FIT explicitly reframes. A new, preset, imported or library coaster resets this cache through the existing resetHistory lifecycle.
- The zoom readout updates from the actual camera state after wheel/pinch/button actions. Zoom affects only camera and existing touch targets, never node locations, spline, terrain or physics.

## Regression evidence
- `tests/elevation-draw-regression.mjs` extracts `openElevationPoint` from the **production** player module and checks SIDE X/H, FRONT Z/H, hidden-coordinate/bank inheritance, 0.1m rounding, world-bound clamps, near-duplicate and invalid input rejection, source immutability, and runtime preview/camera lifecycle hooks.
- `tests/browser-smoke.mjs`: on real mobile Chromium WebGL, place station in TOP, tap empty SIDE paper to create an uphill segment, zoom via button and switch away/back to verify view memory, FIT, then tap FRONT to append with inherited X; verify bank and upstream points unchanged, and exact Undo/Redo.
- All older tests (3D orange cap/blue grip/lime picks at extreme banking, SIDE/FRONT dragging, 80-node workflow, local save, terrain, supports, and exact physics fingerprints) remain mandatory.

## Risks and deliberately unshipped
- **Real iOS Safari** multitouch, click/pan discrimination and performance still require acceptance on actual hardware.
- This is not a native NoLimits project importer, four simultaneous linked viewports, editable Bezier tangent handles or a physics rewrite.
- Each view displays the same source node list and spline, not a second editable representation.

## Source references
- [PR #28](https://github.com/richerd22/SomeLimits/pull/28)
- [Single-file editor](https://github.com/richerd22/SomeLimits/blob/main/play/index.html)
- [Browser acceptance](https://github.com/richerd22/SomeLimits/blob/main/tests/browser-smoke.mjs)
- [Source regression](https://github.com/richerd22/SomeLimits/blob/main/tests/elevation-draw-regression.mjs)
