# SomeLimits wiki

SomeLimits is a browser-based roller coaster builder. You place points on a ground plane, drag them around, set height and banking, and get a full closed-circuit coaster you can ride. It is a loving, low-key revival of the NoLimits 1 building feel - relaxed building, real coaster grammar underneath - not a remake, not a clone, and not affiliated with NoLimits. Original code, original assets. The name is a dry joke: a coaster sim with some limits. there always were.

North star, in one line: a returning NL1 builder lays a full closed-circuit coaster within minutes, zero tutorial.

## Start here

- [Player guide](player-guide.md) - building your first coaster, controls, riding, library, sharing, FAQ.
- [Code](code.md) - how the single HTML file works: track math, physics, save formats.
- [Dev](dev.md) - running it locally, repo layout, conventions, testing, forking.
- [Admin](admin.md) - hosting, updates, ownership, trademark posture, and the imagery rule.
- [Editor runtime](editor-runtime.md) - why drag builds are coalesced, how GPU objects are released, and why library thumbnails are regenerated.
- [Large-coaster terrain index](terrain-proximity-bvh.md) - exact segment BVH and one distance per grid vertex; benchmark and 80-node browser verification.
- [Shared editable-node materials](node-handle-material-pooling.md) - preserve 80 unique point picks with just two selected/lime material resources per rebuild.
- [True arc-parameter reuse](arc-parameter-cache.md) - one exact curve mapping per sample reused for height limits, lift and bank, closed and open, with full sample parity.
- [Support clearance](support-clearance.md) - spatial broadphase proof, exact crossbeam minima and regression tests.
- [Mobile performance](mobile-performance.md) - device pixel ratio, on-demand library blueprints and caching limits.
- [Browser smoke](browser-smoke.md) - full HTML/Three.js boot in Chromium, real DOM editing and mobile viewport, with explicit limitations.
- [Exact point drags](direct-point-drag.md) - why releasing a point must not shift its neighbours or adjust their banking.
- [Complete coaster direct lime-node test](completed-lime-node-touch.md) - actual touch x/z and height drags on an elevated banked non-station node, with history/neighbor invariants.
- [Draft rescue](draft-rescue.md) - warnings when browser autosave fails and export/import for unfinished coasters.
- [Station framing](station-framing.md) - Frame Track camera fallback for empty plots and lone imported stations.
- [Ride insight](ride-insight.md) - actual speed-assist observations on the lap summary and clean G-force graph restarts.
- [Empty draft and station ownership](empty-node-station.md) - no stale inputs when starting blank; station checkbox can move but never erase the one station.
- [Touch interruptions and actual gesture testing](interruptions-and-touch-regression.md) - recover from focus/capture loss and test the real 3D point drag through Chromium.
- [First station precision handles](first-station-precision-handles.md) - shared cap/grip renderer for the first station and completed tracks; touch-gesture proof.
- [Screen-readable mobile bank grip](touch-grip-pixel-target.md) - camera-relative blue gizmo at zoom, five-point real-touch regression, unchanged desktop geometry.
- [Bank grip remains readable after zoom](mobile-bank-grip-camera-zoom.md) - transform existing touch gizmo meshes with OrbitControls, no track re-sampling or GPU churn.
- [All touch halos follow camera zoom](mobile-touch-halo-camera.md) - original cap/node/grip radius policy, reusing the same proxy meshes, no track rebuild.
- [Extreme-bank touch ownership](extreme-bank-touch-arbitration.md) - touch-test cap, blue grip and lime node separately at -90/-80/+90 degrees, grounded pixel gaps.
- [Lift/drag playtest repair](../playtest-2026-11-18.md) - physics before/after for all four presets and the custom playtest.
- [Branch/physics audit](branch-hygiene-physics-audit.md) - why squash-merged PR heads look divergent, safe cleanup and exact regression fingerprints.

There is also an in-app Field Manual. Press H in the app for the short version of the player guide.

## The app in one paragraph

The whole game is one self-contained HTML file at `play/index.html`. It uses Three.js from a CDN. No build step, no backend, no accounts. Your coasters live in your browser. See the player guide for what that actually means for your saves.

## Maintenance quick check

Run `node tests/editor-runtime-regression.mjs` for the editor lifecycle. The physics fingerprint regression is `node tests/physics-regression.mjs` after temporarily installing `three@0.160.0`. Both run in GitHub Actions before changes reach main. No build pipeline was added to the game.

## House rules

- No AI-generated imagery anywhere in the project. Logo, textures, splash art, none of it. Visuals are hand-drawn SVG or code-rendered 3D only. See [Admin](admin.md) for the policy version.
- Loving knockoff posture. Homage in spirit only. No NoLimits assets, code, or branding. The only bridge is the documented CSV spline format in [Code](code.md).
- Defaults always yield a rideable circuit. If a first build can stall, confuse, or dead-end, that is a bug in the design, not a skill issue for the player.
- Honest copy. If a feature is not in v1, the docs say planned, not present.

## Status

v1, shipped. Anything beyond the shipped list in these pages is marked planned.
- [Classic blueprint/elevation editor — lift crest, turn, drop workflow](blueprint-elevation-editor.md) (Round 25)
- [Orthographic drafting-paper clarity and physical SIDE/FRONT touch regression](drafting-views-round26.md) (Round 26)
- [Precision editor: overlapping node navigation, coordinates and view-correct keyboard nudging](precision-node-authoring-round27.md) (Round 27)
- [Draw new track directly in SIDE/FRONT with a ghost preview and view-stable zoom](elevation-drawing-round28.md) (Round 28)
- [Optional 1m/5m drawing snap, TOP ghost preview and measured next segment](drafting-snap-round29.md) (Round 29)
- [Honest curved ghost rail preview, actual-spline point refinement and lift continuity](curve-truth-round30.md) (Round 30)
- [Adjustable next-section distance, turn angle and drop geometry behind the advanced inspector](advanced-section-dimensions-round31.md) (Round 31)
- [Simultaneous linked 2D/3D editing, independent TOP/SIDE/FRONT paper and shared Undo history](linked-drafter-round32.md) (Round 32)
- [Movable, resizable linked drafting window with on-screen bounds and remembered layout](linked-workspace-round33.md) (Round 33)
- [Explicit Shift-drag tangent constraint for deliberate linked curve shaping](tangent-shaping-round34.md) (Round 34)
- [Keyboard-free tangent-lock toggle for linked curve shaping](tangent-lock-round35.md) (Round 35)
- [Remembered tangent workspace preference and focused-paper T shortcut](tangent-workspace-round36.md) (Round 36)
- [Centripetal rail-accurate tangent guide for linked curve shaping](rail-tangent-round37.md) (Round 37)
- [Direct ± tangent nudges for deliberate fine curve shaping](tangent-nudge-round38.md) (Round 38)
