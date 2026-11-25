# Round 41 — primary rail-direction nudges

The full-size TOP/SIDE/FRONT editor now has **−T** and **+T** beside its tangent control. Each moves the selected original control node 1 metre backward or forward along the visible, rail-accurate guide; Shift-click moves 5 metres.

These are direct, ordinary node edits: each makes one Undo entry and preserves neighbouring nodes, bank and hidden axes. They intentionally bypass drawing-grid snap so a labelled metre cannot vanish into an unrelated snap setting. No tangent handles, save data, preset geometry, spline or physics behavior are introduced or changed.

Real mobile Chromium coverage taps primary **+T**, verifies the result remains on the rail direction with height/neighbours unchanged, then performs exact Undo. Full desktop/mobile WebGL, curve and fingerprint checks remain the release gate.
