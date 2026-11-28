# Direct point drag contract: what you grab is what moves

Updated November 18, 2026. Motivation: NoLimits 1 builder simplicity, without hard-to-predict control-point behavior.

## The issue

The game already draws a smooth centripetal Catmull-Rom spline through control points. However, a separate historical `smoothAround(idx)` pass ran **on release of every sideways plan drag** when the document contained 7 or more nodes. This was easy to miss because the track looked fine during a drag, then changed slightly on release.

That old pass did three surprising things:

1. It pulled the **grabbed node itself** 18% toward the midpoint of its two neighbors, so it no longer landed where the builder dragged it.
2. It moved the **four surrounding control points** up to 30% toward their own adjacent midpoints, so a drag could move five nodes at once without asking.
3. It changed the point-local **banking numbers** of those five nodes based on their adjacent angles, despite the builder not touching the blue bank grip or slider.

The old pass deliberately spared heights because a previous playtest found it was silently flattening crests and filling drops, but that left x/z positions and bank values unexpectedly mutable. For someone who just wants to place points and drag things, an invisible transformation at pointer-up is a bad contract.

## Decision shipped

- **Only the point you grabbed moves in a plan drag.** Its x/z coordinates update from the camera-facing drag-plane intersection relative to the grab offset, clamped to ±150 m.
- The exact dragged coordinates **survive release**. The release still clears pointer ownership, performs the final geometry/terrain rebuild, then commits history/autosave, but it does not relax points.
- The original, implicitly invoked `smoothAround` function is removed. No equivalent hidden "clean up" is run.
- Height and bank remain untouched during a plan drag, including on the dragged node. Adjacent points are byte-for-byte unchanged.
- `setNodePlanPosition(list, idx, x, z)` centralizes the small pure mutation boundary. It returns false for unchanged values, missing nodes or non-finite coordinates, avoiding redundant preview builds.
- **Track shape is still continuously smoothed by Catmull-Rom interpolation between nodes.** That is different from silently changing those nodes. Point-local bank interpolation continues to use the existing shortest-angle cosine blend. No new roll nodes, editor modes, sliders or options are introduced.

The user is in charge of their control points. If a curve looks too sharp, they can move one of the points or insert another; this is not a reason to reposition neighbors without permission.

## Acceptance tests

A new dependency-free, source-extracted regression runs with:

```sh
node tests/direct-point-drag-regression.mjs
```

The source-only test reads `play/index.html` (not a copied implementation), parses the game module and extracts the actual `setNodePlanPosition` helper. A separate full [Chromium browser integration](browser-smoke.md) performs real sideways/upward touch gestures on the centered station and now **also** on a banked, elevated, nonstation lime point in a five-node completed coaster. That real-browser test confirms only x/z change on sideways motion, only height changes on upward motion, banking and the four other nodes remain unchanged, and exact previous/new values round-trip through Undo and Redo. See [Complete coaster direct lime drag](completed-lime-node-touch.md). It uses eight deliberately uneven points with a 47.5m hill and nontrivial bank values, including a station, and checks:

- Dragged x/z equal the exact requested coordinates.
- Dragged height, bank and station state are unchanged.
- **All seven other point objects remain deeply equal to their originals.**
- Identical movements are no-ops.
- A position beyond ±150m clamps only the dragged point.
- Invalid index and NaN/Infinity input cannot mutate any point.
- Dragging the station retains its station flag.
- `smoothAround` is not secretly invoked on release.

This regression runs in GitHub Actions alongside the actual Chromium desktop/mobile smoke, support-clearance equivalence, library/GPU lifecycle, and physics/share checks. The classic preset physics baseline remains the current provisional **44.4s / 86 km/h**, because neither the existing presets nor the integrator changed. User-edited tracks will intentionally preserve the positions *they actually chose* rather than the historical post-release relaxation.

## Manual browser acceptance

- [ ] Start from a blank plot and create a 7–10 point coaster.
- [ ] Drag one lime point sideways and release; observe that it stays under the final release position.
- [ ] Select either neighbor and verify its x/z/height/bank values remain untouched after the drag.
- [ ] Bank an adjacent point at a visible angle; drag its neighbor on the plot. Verify banking doesn't change.
- [ ] Drag the same point multiple times; the geometry follows the hand rather than drifting toward a smoothed midpoint after each release.
- [ ] Undo once restores only that drag's document and redo repeats it.
- [ ] Try the same with a high crest and banked turn on desktop and touch.
- [ ] Load classic and ride: the preset physics fingerprint remains stable.

## Design tradeoff

The old pass sometimes hid awkwardly spaced points by mutating the actual document. Removing it can reveal kinks a user created, but the editor now responds honestly: **your point, your position**. The better long-term improvement is clearer visual feedback and direct manipulation, not opaque automatic editing. No AI-generated imagery is used.

Related: [Editor runtime](editor-runtime.md), [Player guide](player-guide.md), [Architecture](code.md), [Browser integration](browser-smoke.md).
