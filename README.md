# SomeLimits - a coaster sim with some limits

Richard's project, started Nov 11, 2026 (3:33 AM voice rant). The pitch in
his words, paraphrased tight: NoLimits 1 was the relaxed, easy coaster
builder - Minecraft energy with the real coaster grammar underneath.
NL2's editor got fiddly: elements could go unrealistic and were hard to
fix, turns and piece connections did weird things. His NL1 license is
stranded - the official portal is a dead login gate and the site is
down - so we build our own open one.

## Scope lock (Richard, Nov 11)
- NOT an element toy. The full loop: lay out a COMPLETE closed-circuit
  coaster end to end (station, lift hill, drops, banked turns,
  inversions if wanted), then RIDE it start to finish.
- Browser first. Desktop app only if browser can't carry it.
- Relaxed building, real physics grammar underneath. No accounts, no
  nonsense: open it and build.

## The north star (Richard, Nov 11, 2026)
Richard OWNS NoLimits 2 and was never able to figure out how to build a
coaster in it. NL1 was easy for him. That gap is the whole product
thesis - and the acceptance test: **a returning NL1 builder must be
laying track within minutes, zero tutorial, zero mode taxonomy.**

Framing, precisely: NL2's editor power is documented and respected.
SomeLimits is not claiming NL2 is bad. It is claiming the door was
locked for casual builders - some of them own it and still cannot
get in. We are building the door.

Design rules that follow:
1. The mental model stays "place points, track appears, drag things."
   No separate roll-node objects, no strict-node bookkeeping, no
   separator system to learn before the first hill exists.
2. Banking lives on the point itself (slider), with local blend.
   Sacred - do not regress this into NL2-style roll nodes.
3. Defaults always produce a complete rideable circuit: presets ship
   rideable, and any climb of 8m+ between nodes auto-gets a lift chain
   (in the prototype since Nov 11) so a first build cannot stall.
4. Advanced power (per-segment types, smoothing controls) reveals
   itself progressively and never gates the basics.

## Layout
- `play/index.html` - **v1, the game.** Single self-contained file
  (Three.js via CDN): node editor with drag/insert/undo/redo,
  parallel-transport frames with continuous banking, auto-lift on
  8m+ climbs, auto-smooth on drag release, ride mode with
  POV/chase/orbit cameras, live G HUD and lap summary, named saves
  library in localStorage with blueprint thumbnails, exports (JSON,
  NL2 CSV spline, PNG), and share links that encode the coaster in
  the URL. Open it in any modern browser, or serve the folder with
  any static host. Start: `python3 -m http.server` then visit
  /play/.
- `wiki/` - the full wiki: player guide, code architecture, dev
  guide, admin/hosting guide. Start at wiki/README.md.
- `prototype/index.html` - v0 browser prototype (Three.js) that v1
  grew from: closed-loop Catmull-Rom spline through draggable nodes,
  continuous banking (the fix for NL's kinked connections), lift-hill
  segments with chain speed, station, supports, presets,
  save/export/import, ride mode with POV/chase/orbit cameras and
  energy-based speed + G readout. Kept for history.
- `research/` - the NL1 vs NL2 research (editor feel, smoothing math,
  file formats, ecosystem state). Deep-research run landed Nov 11;
  see research/SUMMARY.md.

## Verified ecosystem state (Nov 11, 2026, browser check)
- Archived official download portal (Aug 19, 2025 capture): a User-ID +
  Key login gate only. No public downloads, no lost-key path.
- Live nolimitscoaster.com: homepage shows "down for maintenance",
  pointing only to the NL2 Steam page. /index.php/resources is a 404.
- So NL1 is effectively unrecoverable through official channels; NL2
  lives on Steam. (Full detail in research notes.)

## HARD RULE - no AI-generated imagery (Richard, Nov 11, 2026)
No AI-generated imagery anywhere in SomeLimits: not the logo, not
textures, not splash art, nothing that reads as AI slop. All visuals
are hand-drawn vector (SVG), code-rendered geometry, or clean type.
This is Richard's standing aesthetic rule, applied project-wide.
