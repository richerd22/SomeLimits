# Round 33 — movable and resizable linked drafting workspace

## Player problem

Round 32 delivered simultaneous live 3D + 2D authoring, but the orthographic drawing was fixed at the bottom-right of the viewport. On large or unusual coasters that floating pane could cover the rail region a player was trying to inspect, and a fixed pane size did not suit every monitor.

## Editor interaction contract

- The **empty header / LINKED DRAWING title** is a drag grip. Drag to move the entire linked pane around the desktop viewport; projection, zoom, FIT, and close buttons remain normal clickable buttons and never initiate a window drag.
- The **lime lower-right corner** is a dedicated resize grip. Drag to resize the secondary 2D paper. The **Canvas2D backing buffer automatically resizes** via a ResizeObserver, capped at DPR 2, with no second WebGL context, new track geometry, rails, supports, or physics recomputation.
- The resize grip is keyboard-focusable: Arrow keys adjust width/height in 20px steps, Shift+Arrow by 40px. Keyboard events are stopped before reaching the main coaster's arrow-nudge shortcut.
- The pure `clampLinkedRect(rect,windowWidth,windowHeight)` function guarantees the pane's final rectangular bounds remain entirely inside the viewport, with a practical 360x200px minimum on desktop. Oversized, negative, or partially corrupt stored layout values cannot make the pane disappear. On small phones the mobile CSS size owns the layout and the pane starts closed by default.
- Completing a drag or resize saves **only the final safe layout** under the separate editor preference `somelimits-linked-pane-layout-v1`. No intermediate pointermoves write localStorage, and pointercancel restores the previous rectangle without committing. Reloading the game reopens the pane at its chosen size and location.
- Resizing/repositioning the browser window re-clamps the secondary pane within the available screen. When switching to narrow mobile geometry, inline desktop positioning is cleared and the small-screen CSS rules take over.

## Compatibility and architecture

- Only the original single WebGL renderer, world camera, physics, source node model and Undo history remain authoritative. The extra Canvas2D viewport is a second **visual representation and input surface** of the same coaster.
- No new coaster document properties, schema migrations, asset downloads, runtime dependencies, train physics changes, curve interpolation changes or loss of the existing one-tap turn/drop controls.
- The original mobile handle and overlay collision tests must continue to pass, since the second pane is hidden by default on phones and the floating controls are not enlarged.

## Evidence and tests

- `tests/linked-drafter-regression.mjs` checks pure bounds clamping for negative/oversized/corrupt rectangles, desktop and phone sizes, plus the existing coordinate-projection and 80-node framing tests. It also guards pointer-capture lifecycle, keyboard resize controls, resize restoration, and editor-only preference persistence wiring in actual production HTML.
- `tests/browser-smoke.mjs` uses real desktop Chromium pointer events after the linked SIDE/FRONT edit journey: it drags the empty pane header, resizes using the lower-right grip, verifies the CSS rectangle changes, checks original saved coaster nodes did not change, and reloads the page to verify the saved pane rectangle and coaster document both restore exactly. Simulated 390px mobile still requires the pane hidden until intentionally enabled.
- Existing physics fingerprints, live 3D node grips, lift ownership, linked SIDE/FRONT input, history, terrain and supports remain required in CI.

## Limits

This is not yet a full arbitrary four-way docking workspace, resizable side-by-side GPU viewport, tangent-handles feature, NoLimits native importer, or actual iOS Safari hardware certification. The priority is solving day-to-day editor usability with the smallest safe change.

## References

- [PR #34](https://github.com/richerd22/SomeLimits/pull/34)
- [Linked Canvas2D module](https://github.com/richerd22/SomeLimits/blob/main/play/linked-drafter.js)
- [Production HTML](https://github.com/richerd22/SomeLimits/blob/main/play/index.html)
- [Exact layout regression](https://github.com/richerd22/SomeLimits/blob/main/tests/linked-drafter-regression.mjs)
- [WebGL desktop/mobile acceptance](https://github.com/richerd22/SomeLimits/blob/main/tests/browser-smoke.mjs)
