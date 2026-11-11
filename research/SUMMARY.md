# SomeLimits - research summary (Nov 11, 2026)

Full report: ~/workspace/research_notes/nolimits-rebuild-research-20261111-0837/report.md
(50 KB, five mission questions + build recommendation, all sourced.)

## NL1 vs NL2 - the feel, in one breath
- NL1 (2001): separate Editor/Simulator/Terraformer apps, one coaster per
  file, track = adjacent Bezier segments with a vertex + two control points
  each. Only 5 segment types (regular, station, transport, lift, brake) and
  prefab loop/corkscrew/zero-g buttons. Contemporary verdict: "surprisingly
  easy to use." BUT it was not smooth by default - pumping/jerk between
  segments was so common the community built AHG (Auto Heartline Generator),
  an 11-step smoothing ritual. NL1's ease was real; its smoothness was DIY.
- NL2 (2014): park-first, one continuous spline through vertices, banking on
  separate roll points, separators for lift/brake/station, auto-bank, live
  radius/speed/G combs. More power, more workflow friction.
- The documented NL2 pains, i.e. SomeLimits' fix list:
  1. straights need "strict" nodes (2 strict = perfectly straight) - so:
     one-click Straight toggle, no secret handshake.
  2. roll nodes BLEED along the whole track unless bookended with 0-degree
     strict rolls - so: roll as a scalar field with LOCAL blend support and
     pinned points. Banking stays where you put it.
  3. continuous roll "wobble", fixed by trial-and-error strict/continuous
     pairs - so: curvature-fairing relaxation pass on drag-end (an
     automatic, invisible AHG) instead of hand-smoothing rituals.
  4. heartline is whole-track only in NL2 - so: heartline-first build with
     per-section control where it matters.
  5. transfer tables / saved elements / undo quirks - out of v1 scope,
     noted so we never import them.
- Balance, honestly: plenty of builders found NL2 EASIER than NL1 for curves
  and inversions. The pain is edge cases and workflow, not the spline. We
  keep the spline; we kill the edge cases.

## Track math (what v0 already does, what v0.2 adds)
- Already in the prototype: centripetal Catmull-Rom (closed), arc-length
  resampling, banking interpolated as a continuous scalar field.
- Research says swap my frame math to parallel-transport /
  rotation-minimizing frames (Frenet frames flip 180 degrees at inflections
  and are undefined on straights - Three.js TubeGeometry uses them, which is
  why the prototype builds rails from custom frames already).
- Clothoid connectors at seams: curvature linear in arc length = no force
  jumps. Connect contract: match position + tangent + curvature + roll,
  spread any mismatch over a clothoid blend zone.
- Physics: energy integration (what the prototype does), G from v^2/R
  decomposed into vertical/lateral via the track frame. Clothoid loop
  reference: ~3.5-4.5 G.

## File formats + interop
- NL1 .nltrack is binary; NL2 .nl2park format is NOT public; .nl2pkg is a
  ZIP with XML inside; .nl2elem is plain XML.
- The golden door: NL2 exports/imports a CSV spline (Position + Up vectors
  are all an importer really needs). SomeLimits v1: JSON save/share (done)
  + NL2 CSV export/import so builds can round-trip into NL2. No binary
  parsing in v1.
- Prior art to learn from, not copy blindly: openFVD (GPL-3.0 - port the
  math, don't lift code), NoLimits2PackageLoader (MIT), Newton2 (origin of
  force-vector design: specify the Gs, it shapes the track - a later
  "pro mode" idea), COASTER LAB (free browser proof the shape works).

## Ecosystem state (Nov 11, 2026)
- Official site: "down for maintenance," points only to Steam. NL2 $39.99
  on Steam, still patched (2.6.8.x, Dec 2025 / Jan 2026), Overwhelmingly
  Positive. NL1: not sold anymore; owners "can still request a new download
  link" per the resources page - which matters because:
- CORRECTION to what I said on the call: I told Richard the portal was a
  total dead end with no lost-key path. The download portal is indeed a
  login gate, but the resources page says NL1 customers can still REQUEST a
  new download link. Worth one email before writing the key off entirely -
  his call; SomeLimits proceeds either way.

## Build recommendation (adopted)
Browser + Three.js static app (what's already running). v1 = the current
prototype + strict/straight toggle, local-blend roll, fairing pass,
parallel-transport frames, live G combs/HUD (partly in), NL2 CSV in/out.
Out of v1: parks, scripting, terrain, flat rides, binary formats, FVD mode.

## Framing note (Richard, Nov 11)
The north-star data point: Richard owns NL2 and never figured out how to
build a coaster in it, while NL1 was easy for him. So the research reads
this way: NL2's power is real and respected - the failure is the on-ramp.
SomeLimits is not "NL2 but better"; it is the door NL2 never built for
casual builders. Acceptance test: a returning NL1 builder lays track
within minutes, zero tutorial, zero mode taxonomy.
