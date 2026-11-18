# Interrupted drags: never strand a point or disable the camera

Updated November 18, 2026. Scope: **actual input lifecycle**, not new editing modes.

## Problem

A mouse/pen/touch drag is not guaranteed to end with `pointerup` or `pointercancel`. Browser chrome, a system overlay, focus loss and backgrounding can cause the page to stop receiving pointer events. A captured pointer can also emit `lostpointercapture` without the app's ordinary release/cancel path running.

The original editor already handled:
- Normal `pointerup`: finalize the dragged point's current exact position, perform the final synchronous geometry rebuild, then commit undo history + autosave.
- `pointercancel`: restore the picked point's original x/z/h/bank snapshot, clear interaction state, let the camera go when the remaining fingers are up.
- Second finger during an owned gesture: cancel the uncommitted edit and hand the gesture back to orbit/pinch behavior safely.

But if capture simply went away, `activePtr` could keep its old pointer ID while the physical finger/mouse had gone. The next real press looked like a second finger, `controls.enabled` could remain false, and the temporary drag could be stranded. For a direct manipulation builder, this is especially bad: an interruption shouldn't appear to move a control point without any completed edit.

## Implementation

- **`lostpointercapture`** on the rendering canvas now cancels the unfinished gesture **only when the lost pointer is `activePtr`**. It clears active ownership and uses the existing `cancelGesture()` rollback. When no remaining fingers are down, it restores the OrbitControls camera via `releaseControlsHold()`.
- **Window `blur`** or document **`visibilitychange` to hidden** calls `abortInterruptedInput()`. This clears active/passenger pointer IDs, invokes the same rollback, and releases any camera hold.
- The cancellation helper also clears `pressAt`, so the next drag never inherits a stale tap origin.
- **Normal `pointerup` remains authoritative**. The browser often emits `lostpointercapture` *after* a successful `pointerup`; the code has already cleared `activePtr`, so the later event is ignored. A completed user edit still commits once and never rolls back retroactively.
- A second finger still causes an intentional uncommitted rollback, as previously. Camera hold remains until all fingers have lifted, preventing OrbitControls' abrupt teleport from stale pointer coordinates.

No new buttons, tool modes, camera modes, imagery, saved document fields or physics changes. The game is still a single HTML file, dependent at runtime only on pinned Three.js CDN modules.

## Browser verification

The maintainer-only `tests/browser-smoke.mjs` loads the exact production `play/index.html` in headless Chromium with software WebGL (no editor mock). It previously checked boot, saving, undo helper behavior, draft JSON, library blueprint and a touch station tap. This round extends the **mobile Chromium context** with low-level browser touch events:

1. Start with a blank plot; place a station with a tap; use the actual Frame Track control to center it.
2. Touch the lime station handle, drag **upward**, and release. Confirm that the real autosaved station height increases, while its x/z position, banking and station role remain identical.
3. Click Undo and verify the original height is restored. Click Redo and verify the new height returns.
4. Undo again. Start a second physical-style touch drag, then dispatch a window blur **before touchend**. Confirm the node returns to its grab-time height and the autosaved node data was not modified.
5. Place a second finger during another uncommitted drag. The first point must return exactly to its grab snapshot; moving either finger afterwards must not modify it. Lifting both fingers must leave no saved change.
6. Force the canvas to release its actual captured pointer during a third ongoing drag, without a pointercancel. The new lostpointercapture handler must roll back the temporary edit, and autosave must remain unchanged.
7. Start a *new* touch drag after the two interruption routes; it must actually edit and save again, catching stuck pointer ownership or a permanently disabled camera.
8. Verify there were no browser console errors; complete the previous desktop and mobile smoke paths.

This is a much stronger input integration check than copying `setNodePlanPosition()` into an isolated stub: it runs pointer capture, Three.js picking, drag-plane math, queued geometry rebuilds, history and localStorage together. It still **does not prove real iOS Safari**; native touch gesture arbitration, OS interruptions and hardware frame times must be validated on an iPhone/iPad.

## Manual acceptance

- [ ] Mouse: start dragging one point, switch away from the tab/window mid-drag, return and drag again. The point must not remain half-edited and the camera must orbit.
- [ ] Touch: place a lone station, drag straight up and release, then undo and redo. Its horizontal coordinates and banking must remain unchanged.
- [ ] Touch: start dragging a point, put a second finger down; the original point must revert without a ghost commit. Once fingers lift, one-finger camera orbit must work again.
- [ ] Touch: interrupt a cap/roll-grip drag with a system gesture, background the page, return. The grabbed height/bank must return to its original value; the next drag must work.
- [ ] Browser: normal pointerup is followed by implicit lostpointercapture without undoing the already committed drag.
- [ ] All four presets still ride and classic physics remains **27.45 s / 88 km/h**.

## Follow-ups

Additional tests now exercise a second finger during a grab and `lostpointercapture` independently of blur. The remaining substantial extension is movement/undo/redo for an ordinary multi-node completed coaster, plus orange-cap and blue-grip gestures. The design rule is that an **unfinished** gesture is reversible and **only** a successful release commits. This prevents a large class of inputs from leaving users wondering whether a change was saved.

Related: [Editor runtime](editor-runtime.md), [Exact point drag contract](direct-point-drag.md), [Browser smoke](browser-smoke.md), [Mobile performance](mobile-performance.md).
