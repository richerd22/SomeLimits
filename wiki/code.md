# Code

How `play/index.html` works. One file, no build, no backend.

This page documents the shipped v1. Anything else is marked planned.

## Shape of the file

- A single self-contained HTML file: markup, CSS, and one vanilla JavaScript module.
- Three.js is the only dependency, loaded from the unpkg CDN via an importmap:

```html
<script type="importmap">
{"imports": {"three": "https://unpkg.com/three@0.160.0/build/three.module.js",
             "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"}}
</script>
```

Pinned version: `three@0.160.0`. If the CDN is unreachable, the module does not run - so a small non-module watchdog script sits in front of it: if boot has not finished within 9 seconds, it shows a plain warning saying the library has not arrived and what to check, instead of leaving a dead title screen. That is the one external dependency and the docs do not pretend otherwise.

- Layout stacks panels on small screens via responsive CSS. No framework.

## State model

The coaster is the nodes. Everything else is derived.

```js
// one node
{ x, z, h, bank, lift, station }
```

- `x`, `z` - position on the ground plane, in metres.
- `h` - height in metres.
- `bank` - banking in degrees, -180 to 180.
- `lift` - optional boolean: chain lift starts at this node.
- `station` - boolean: exactly one node is the station. Setting a new one clears the old one.

Plus app state: selected node index, mode (edit or ride), camera mode, the undo and redo stacks, and the sampled track (below). The sampled track is a cache. Rebuild it from the nodes, never edit it as source of truth.

Minimum 4 nodes for a closed circuit, enforced on delete.

## Sampling pipeline

Rebuilt whenever the nodes change.

1. **Spline.** A closed centripetal Catmull-Rom spline through the node positions `(x, h, z)`. Centripetal, not uniform, so tight node spacing does not throw loops or cusps.
2. **Sampling.** The spline is sampled at 900 points around the loop, with cumulative arc length `s` recorded per sample.
3. **Frames.** Each sample gets a frame via parallel transport - rotation-minimizing frames. Start from an initial frame, then propagate the normal along the tangent, rotating only as much as the tangent change requires.

   Why not Frenet frames: Frenet normals flip 180 degrees at inflection points and are undefined on straights. Parallel transport does not. The research notes in `research/SUMMARY.md` cover this.

4. **Bank roll.** Each distance-spaced sample maps back to its true Catmull-Rom parameter through `getUtoTmapping` before selecting its source node segment. This keeps lift flags and bank blend anchored to the actual node on uneven tracks. Banking is applied on top of the transported frame as a roll about the tangent.
   - Node bank angles are interpolated between nodes with cosine easing.
   - Interpolation takes the shortest angular path, with wrapping - so going from 110 to -110 travels through 180, the inversion, not back through 0.
   - Result per sample: position, tangent, up vector (banked), side vector, arc length, and a lift flag (see Physics).

5. **Lookup.** `sampleAt(s)` wraps `s` around the total track length and linearly interpolates between the two nearest samples for position, tangent, and up. The ride loop and the cameras both use it.

## Geometry generation

Built from the samples, rebuilt with the track. All code-rendered. No model files, no textures, no images.

- **Rails.** Two steel rails as ribbon geometry, offset to either side of the centreline along the sample side vector. Vertices come straight from the frames, indexed into strips.
- **Ties.** Wooden ties as instanced boxes, placed along the samples, oriented by each sample frame.
- **Supports.** Auto supports: vertical posts from the ground to the track at intervals where the track is high enough to need them. Placement is automatic; there is no support editor in v1.
- **Station platform.** A platform mesh at the station node's sample position, oriented by that sample's frame.
- **Ground.** A ground plane under the layout - the plane the nodes sit on.
- **Node handles.** In edit mode, a draggable handle mesh per node, tagged with its node index for picking via raycast against a horizontal drag plane at the node's height.

## Support clearance broad phase

Centre-post keep-out checks now query an 8 m x/z spatial grid, then apply the *same* exact arc, height and horizontal-distance tests. This is a safe broad phase, not a relaxation of collision rules: any sample within sqrt(2.9) m horizontally lies inside the indexed query region. Side-frame beam clearance compares squared distances and performs one final square root, preserving its minimum and 1.15 m threshold. Diagnostics remain on `window.__slSupports`; see [support clearance](support-clearance.md) and `tests/support-clearance-regression.mjs` for the proof and brute-force reference.

## One-point editing handles

The first station no longer needs a second control point before its precision editor appears. The original cap/ring/grip geometry was extracted into `buildSelectedEditHandles()` and is now shared by `buildLoneStation()` and `buildTrack()`. `nodeRollFrame()` already has a stable +X tangent fallback for the one-point case, so banking has a defined roll plane even before a spline exists. The first station remains **one point and no track**; its orange cap sets height and blue grip sets point-local bank through the original input handlers. Actual mobile Chromium tests project the two handles and drag each through touch events, asserting one-variable changes and exact Undo/Redo. The floating height/bank label now checks for an existing selected node, **not an existing `track`**, so it works immediately on a lone station and remains hidden on a truly blank plot. The browser smoke checks its live text during both handle gestures. See [First station precision handles](first-station-precision-handles.md).

## Thumb-readable roll grips on completed coasters

A mobile Frame Track camera can collapse the previous fixed 2.6m bank-control ring into only ~4 CSS pixels of node-to-grip separation, even though the selected point's touch halos are already distance-scaled. The source-backed `editGripRadius(n)` keeps desktop at 2.6m, and on coarse-pointer screens computes a 44 CSS-pixel nominal radius from camera distance, FOV and viewport height (bounded 2.6–24m). The blue ring, bar and grip all use the same radius; this **changes only the editor gizmo**, not banking or track geometry. Real Chromium touch on a five-point coaster now verifies selecting a non-station node, raising its orange cap and rolling its expanded blue grip, with unchanged four other node objects and exact undo/redo. See [Screen-readable mobile bank grip](touch-grip-pixel-target.md) and [Browser smoke](browser-smoke.md).

## Camera continuity for mobile banking handles

A bank ring sized only when a point's geometry was built could shrink on the screen after an independent OrbitControls zoom. `refreshTouchBankGizmo()` now runs after `controls.update()`, checks actual camera movement and viewport height, and scales/translates the **existing** blue ring, bar, grip and its hit proxy in place. Its references live on `handleGroup.userData.touchBankGizmo` and are disposed as part of the normal edit-group lifecycle. It never resamples track geometry, runs in ride mode, or changes an active drag's ownership. The existing desktop radius and ride/physics fingerprints remain unchanged. See [Camera-continuous bank grip](mobile-bank-grip-camera-zoom.md) and [source-backed camera regression](../tests/touch-grip-camera-regression.mjs).

## Blank node controls and station ownership

`syncPanel()` now clears and disables node-specific controls when no point exists, rather than retaining values from a previous coaster. A single point reports its actual height and node count without inventing track length, drop or speed. In completed circuits, the station checkbox reassigns the unique station via `assignStation()`; it does not permit removing the last station. The finished-coaster `sanitizeNodes()` likewise normalizes missing/duplicate station flags on import/export and share decode to a single station, preserving the first marked node or falling back to node 0. See [Empty draft and station ownership](empty-node-station.md), including source-backed and actual Chromium DOM checks.

## Framing an unfinished document

With an empty plot or just one station, there is no sampled track and `frameTrack()` falls back to `framePlot()`. The default empty grid retains its original camera eye; `plotFrameTarget(nodes)` focuses a single imported/restored station at its actual x/z/height instead of world origin. Two-plus-node open tracks and completed circuits still use the existing bounds-based track framing. This is why the **Frame Track** button works even before a second point exists. See [Station framing](station-framing.md) and its source-backed regression test.

## Mobile pixels and library preview lifecycle

The Three.js renderer caps device pixel ratio at 2; it preserves DPR 1 and DPR 2 displays but avoids nine backing pixels per CSS pixel on DPR 3 phones. The library builds cards immediately and generates node-derived canvas blueprints through `IntersectionObserver` when cards enter a 180px prefetch margin. Derived thumbnails live in an in-memory 40-entry LRU; the persistent library stores only nodes and metadata. An eager fallback works if the browser lacks `IntersectionObserver`. See [Mobile performance](mobile-performance.md) for numerical reasoning and tests.

## Scene resource lifecycle

Track and selected-handle geometry is rebuilt while editing. Pointer and slider `input` events now call `queueTrackPreview()` rather than rebuilding immediately: only one preview is queued per display frame, using the latest node values. Every release or committed change still uses synchronous `buildTrack()` and cancels a pending preview, so undo and autosave see the finished geometry. `disposeEditGroup()` disposes temporary geometries and materials exactly once, exempting the shared touch halo proxy resources. The terrain and nearby trees settle after the drag flag is cleared, not during the interaction. See [Editor runtime](editor-runtime.md) for the full diagnosis and regression checks.

## Editor interactions

- Direct node dragging is gesture-direction based: after a small dead zone, a screen-up/down drag changes height on a camera-facing vertical plane, while a predominantly sideways drag changes `x`/`z` on the horizontal plane. A press-relative offset prevents jumps. Orange cap and slider retain precise height control. Banking stays on the point with a roll grip, shift/right drag and slider.
- Double-clicking the track raycasts to a track point and inserts a node there.
- On drag release, no automatic neighbour relaxation runs. The original code moved the grabbed point 18% toward its neighbours and the four nearby nodes by up to 30%, including bank changes. That contradicted direct manipulation. `setNodePlanPosition()` now updates only the requested node's x/z, and the spline handles smoothness. See [Exact point drags](direct-point-drag.md) for the decision and regression.
- Auto-lift is computed in the sample pass: a sample segment counts as lift if the source node has `lift` set, or if the climb between its two nodes is 8 m or more.
- Undo and redo are snapshots of the node array on the undo and redo stacks.
- The selected-node readout derives segment length, climb, and grade (climb over segment length) from the selected node to the next node. Pure display, no extra state.

## Physics

The simulator is energy-based, integrated per frame.

- **Integration.** Semi-implicit Euler at the frame's `dt`.
- **State.** Arc position `s` and scalar speed `v` along the track. The train's world position and orientation come from `sampleAt(s)`.
- **Gravity.** From track slope: acceleration is `-g * dh/ds`, where `dh/ds` is estimated by comparing height at `s` with height a short look-ahead ahead.
- **Drag.** Quadratic drag, proportional to `v * |v|`, plus a small constant rolling friction term.
- **Lift constraint.** On uphill lift samples, if the train is slower than 7.0 m/s, chain speed holds it at 7.0 m/s. Lift samples are assigned by true curve parameter, not uniform node index.
- **Brake run.** In the final approach to the station, braking decelerates the train so it arrives back at the station at a stop. Reaching the station stopped ends the lap and triggers the summary.
- **Start.** A ride starts at the station sample at a 6.5 m/s tire dispatch. Flat-only circuits (under 2 m height difference) maintain 6.5 m/s away from the brake zone, since gravity cannot propel a level loop. Hills remain gravity driven after the lift.
- **Lap insight.** The physics retains its original 1.2m/s mid-course minimum-speed guard. Passive telemetry records exactly when that guard intervenes outside brakes, active chains and flat-track tires, plus the slowest unpowered cruising stretch. `lapInsight(ride)` renders a short note beneath Lap Complete, explaining the intervention as a game assist rather than claiming real-world stall/safety. `resetLapState()` clears prior G samples on Start/Restart/Ride Again. See [Ride insight](ride-insight.md).
- **Reference.** The classic preset now runs about **27.5s / 88 km/h** at 1/60s physics steps (previously **47.8s / 86 km/h**). This is a deliberate physics change documented in [the playtest report](../playtest-2026-11-18.md).

### G-force

- Take the train's velocity vector at two successive steps, finite-difference them to get acceleration.
- Add gravity back in - riders feel gravity plus acceleration, not acceleration alone.
- Divide by `g` (9.81) for the G value, and low-pass filter it so the HUD does not jitter sample to sample.
- The ride tracks max G, min G, and airtime: accumulated time where G stays under 0.5.
- Lap summary reports lap time, max speed, max G, min G, and airtime seconds.

### Cameras

- POV: at the train, looking ahead along the track, camera up follows the track up vector - so inversions roll the view.
- Chase: behind and above the train, world up.
- Orbit: the editor orbit controls retargeted at the train.
- C cycles, Esc exits to edit mode.

## Save format

### Library export / import object (v1)

```json
{
  "name": "My Coaster",
  "app": "somelimits",
  "version": 1,
  "nodes": [
    { "x": 0, "z": 34, "h": 3, "bank": 0, "station": true },
    { "x": 0, "z": 12, "h": 3.2, "bank": 0, "lift": true }
  ]
}
```

- `name` - coaster name.
- `app` - the string `somelimits`. Import can check it.
- `version` - format version, `1` in v1.
- `nodes` - the full node array, in loop order. Node fields as in the state model; optional flags may be omitted when false.

Import accepts three shapes:

1. The v1 finished-coaster object above (at least 4 nodes).
2. The v0 raw format: a bare JSON array of nodes, no wrapper. Accepted so prototype-era files still load.
3. A branded **open draft** with `app: "somelimits"`, `version: 1`, `building: true`, `name` and `nodes`. Drafts may have zero or more nodes; importing them preserves the open-building state. The first node, if any, is the station. The dedicated export filename ends in `.somelimits-draft.json`.

Other malformed or too-short completed coasters fail import rather than being converted into fake loops. Drafts use `sanitizeDraftNodes()`, while finished circuits keep the strict existing `sanitizeNodes()`.

## CSV bridge

The NoLimits 2-style bridge. Plain CSV, one row per track sample, with these six columns in this order:

```
pos_x,pos_y,pos_z,up_x,up_y,up_z
```

Per row:

- `pos_x, pos_y, pos_z` - sample position. Note the order on the page: position is x, height (y), z, matching the 3D scene's up axis.
- `up_x, up_y, up_z` - the sample's banked up vector, normalized.

Why this is enough: a spline importer needs a path and a roll reference. Position gives the path, up gives the roll. That pair is all SomeLimits sends, and all it reads.

- **Export** writes all 900 samples in loop order.
- **Import** reads rows in that layout, treats them as points on a loop, and decimates them back into an editable node set. You get nodes, not 900 handles - the imported coaster is editable here, not a frozen spline.

No NoLimits binary formats are read or written. The `.nltrack` and `.nl2park` formats are not public and are out of scope. The CSV bridge is the whole interop story in v1.

## Share links

- Serialize the coaster as the v1 JSON object.
- Encode the JSON string as base64url.
- Put it in the URL hash: `#c=<base64url>`.
- On load, if a `#c=` hash is present, decode base64url, parse the JSON, and load it as the current coaster.

The hash is never sent to a server by the browser as part of a page request, and there is no server here anyway. A share link is self-contained: whoever has the link has the coaster, and there is no link to revoke.

## Storage

All in the browser's localStorage. No network storage anywhere in v1.

- Library key: `somelimits-library-v1` - an array of saved coasters, each an entry holding the coaster data plus library metadata: name, saved date, and the derived stats shown on the card (node count, track length, max height - these can also be recomputed from the nodes on load).
- Autosave: the current work in progress is *attempted* in localStorage on change, and restored on load if no share link overrides it. Browser storage can fail. Failures warn once with persistent editor copy and a working **draft JSON export**; later successful writes clear the warning. See [Draft rescue](draft-rescue.md).
- Blueprint thumbnails are not stored as images. They are drawn on a 2D canvas from the node layout, top-down, when the library renders. The nodes are the storage; the picture is a redraw.

Clearing site data deletes the library and the autosave. There is no backup copy. The code docs say this plainly because the player guide does too.

## Title screen and manual

- Title screen shows the hand-drawn SVG logo and short honest copy. No image assets beyond that SVG.
- The Field Manual is an in-app overlay (H) summarizing the player guide. It is text in the file, not a separate document fetch.
