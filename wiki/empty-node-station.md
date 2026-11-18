# Empty-draft controls and station ownership

Updated November 18, 2026. No additional editor modes, buttons, imagery or runtime dependencies.

## Diagnosis

The newer draft-export flow made it much easier to start, save and restore a coaster before a full circuit existed. A blank plot deliberately has **zero nodes**, and a just-started plot has **one station node but no spline**.

When the app built an empty plot, `buildLoneStation()` already cleared the TRACK DATA numbers; there was **no** lingering previous coaster length/speed there. But `syncPanel()` returned immediately if there was no selected node, leaving its NODE height, banking, station and lift controls at their previous coaster's values. This could show a stale 44m height/bank number and enabled sliders on a document with no node to edit.

A second invariant was less visible: a completed coaster is supposed to have **exactly one station**, but the station checkbox previously did:

```js
nodes.forEach(n => n.station = false);
nodes[selected].station = els.station.checked;
```

Unchecking the current sole station therefore created a **zero-station coaster**. Other parts of the ride system compensated by assuming node 0 was the station, but the saved node data and actual station platform could disagree. This wasn't a player-meaningful choice.

## Shipped decision

### Blank plot: genuinely blank controls

`syncPanel()` updates the name/Continue reference before checking whether a selected node exists. On a zero-node document it now:

- Resets NODE index, height and bank labels to `-`, resets the slider values to neutral defaults, and clears lift/station check marks.
- Disables height, bank, lift, station and Delete Node controls until a real node exists. **+ Node**, the empty plot, Export JSON, presets, and all other normal controls remain available.
- Provides a short instruction in the node readout: click the ground to place your station.
- `buildLoneStation()` reports truthful partial TRACK DATA: **0 nodes** when empty, **1 node and its actual height** when a lone station exists. Track length, drop, maximum angle and estimated top speed remain `-` until a sampled spline exists.

Adding the station restores editable height/banking immediately, while the station checkbox remains locked during open-building mode (it is the structural starting point). No old node values leak into new documents.

### The checkbox moves the station; it cannot erase it

`assignStation(nodes, selected, checked)` is a small source-backed helper. An unchecked or invalid target is a no-op. Checking a node sets that node's station flag and clears the rest, returning whether anything actually changed. The shared completed-coaster `sanitizeNodes()` also normalizes malformed/legacy JSON and share links with zero or multiple station flags: it preserves the **first designated station**, or chooses node 0 if none was designated. All unrelated coordinates, banking and lift values remain intact.

If the user unchecks the **only** station on a finished coaster, the checkbox is immediately restored and a plain toast explains: *every coaster needs a station. select another point to move it.* No build, history commit or autosave mutation occurs. Checking a different node moves the unique station and commits normally.

This doesn't modify ride physics or the station distance calculation, and doesn't add a new mode for managing stations.

## Verification

The zero-dependency regression `tests/empty-panel-station-regression.mjs` reads the actual game source and verifies:

- Blank panel labels/slider values and disabled control states.
- A lone station restores height/bank values and appropriate enabled/disabled controls.
- Moving station ownership clears all other flags; an already-selected station is a no-op.
- Invalid index/uncheck cannot alter station flags or bank values.
- Reassignment repairs a duplicate-station case instead of leaving two owners.

The existing real Chromium smoke now additionally:

1. Unchecks the existing classic station and verifies it remains the single station.
2. Starts a new empty plot and checks the actual DOM inputs and TRACK DATA have no stale values.
3. Places a station on the 3D canvas and checks height/bank controls re-enable, station remains structurally locked during build, node count is 1 and actual station height appears.
4. Continues the prior draft JSON export/import and mobile touch path.

Run locally:

```sh
node tests/empty-panel-station-regression.mjs
```

All other regression suites—real browser WebGL, editor lifecycle, support clearance, ride physics/share, point dragging, draft rescue, station framing, lap insights—remain part of GitHub Actions.

## Manual checks still useful

- [ ] Build a coaster, select a node with nonzero bank and high height, then start a new plot. NODE inputs should be inert and say `-`, not show the old values.
- [ ] Place a single station, then change its height. The partial max-height readout should follow it.
- [ ] Load a complete coaster; uncheck its station checkbox. It should remain checked with one station and a useful explanation.
- [ ] Select a different point, check Station; only that point becomes station. Ride, save/reload and verify the platform follows the correct point.
- [ ] Try the same operations on a real iOS Safari device; Chromium mobile simulation remains a partial substitute.

## North star

Zero hidden state and no fake data. A blank plot should look blank, a single station should be a single station, and a coaster should never quietly lose its required start/finish point.

Related: [Draft rescue](draft-rescue.md), [Station framing](station-framing.md), [Player guide](player-guide.md), [Architecture](code.md), [Browser smoke](browser-smoke.md).
