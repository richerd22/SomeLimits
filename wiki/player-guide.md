# Player guide

Build a coaster. Ride it. That is the whole pitch.

This guide is also summarized in the app as the Field Manual. Press H.

## Your first coaster in five minutes

1. Open the app. You start on the title screen, then in the editor with a preset already loaded. It is already a complete, rideable circuit. You do not have to fix it before it works.
2. Drag a node. Click and drag any node on the ground plane to move it. The track is a smooth loop through all the nodes, so it follows.
3. Pick a node and use the height slider. Raise it to make a hill, lower it to make a valley.
4. Use the banking slider on that node. Banking runs from -120 to 120 degrees. Bank into turns so the ride does not throw you sideways.
5. Let go. On drag release, auto-smooth gently tidies the moved node's neighbourhood - positions and banking. It is the built-in version of the old smoothing ritual. You do not need to do it by hand.
6. Want a lift? Tick lift on a node, or just make a climb of 8 m or more between two nodes. That gets a chain lift automatically. Your first hill cannot stall because you missed a menu.
7. Press RIDE IT, or press R. You start at the station.

If that took more than five minutes, try a preset instead and pull it apart: Classic Circuit, Oval Cruiser, or Get Wild. All three are rideable as loaded.

## The editor

- The track is a closed loop of nodes. One node is the station. That is where rides start and end.
- Double-click the track to insert a node at that point.
- Use + node and delete node buttons if you prefer buttons. Minimum is 6 nodes - below that, a loop stops being a loop.
- Selected-node readout, bottom of the panel: segment length to the next node, climb to the next node, and grade. Use it when a drop feels too steep or too flat. The numbers tell you before the ride does.
- Undo and redo work the way you expect. Buttons, plus Ctrl+Z for undo, Ctrl+Shift+Z or Ctrl+Y for redo.

## Controls

### Mouse

| Action | How |
|---|---|
| Select and move a node | Drag the node on the ground plane |
| Insert a node | Double-click the track |
| Orbit the camera | Drag empty space |
| Pan and zoom | Use the editor camera controls - drag and scroll as labelled in the app |

Height and banking are sliders per selected node, not mouse gestures. That is deliberate. Sliders are boring and precise.

### Keys

| Key | Does |
|---|---|
| R | Ride |
| E | Edit view |
| C | Cycle camera while riding: POV, chase, orbit |
| N | Add a node |
| Delete | Remove the selected node |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+S | Quick-save to the library |
| H | Field Manual |
| L | Library |
| Esc | Exit ride mode |

On small screens the panels stack. It still works, it is just taller.

## Building tips

### Banking

- Bank into the turn, not away from it. If the track turns left, bank left.
- Small numbers first. 30 to 60 degrees carries most turns. 90 is on its side.
- Past 90 on a tight, high section is how you get an inversion. See the FAQ - there is no loop button.
- Banking interpolates smoothly between nodes, with shortest-path wrapping, so a roll keeps rolling the same way instead of snapping back through zero. Set the ends, the middle behaves.

### Lifts

- A flagged lift node gives you a chain lift from that node.
- Any climb of 8 m or more between two nodes gets a chain lift automatically, flagged or not.
- On a lift segment the chain holds the train at about 5.2 m/s. Slow, clanky in spirit, correct.
- One big lift at the start is the classic shape: up slow, down fast, spend the height for the rest of the lap.

### Drops, hills, and speed

- Speed comes from height. No height, no speed. The physics is energy-based: gravity from the slope, minus drag and a little rolling friction.
- A drop that falls short will not magically make the next hill. Raise the first hill or lower the next one.
- Check grade in the selected-node readout. A wall is not a hill.

### Inversions

- There is no element menu. A loop or a roll is just banking plus shape.
- Make a tight turn or a tight crest, then crank banking past 90 degrees through it, and back out the other side.
- Keep speed up going in. Inversions at walking pace are just falling over, slowly.

### Smoothness

- Drag, release, let auto-smooth do its pass. Drag again if you want more change.
- Fewer, well-placed nodes usually ride smoother than a node every metre.
- If a section jerks, check the two nodes around it first - a sudden height or banking jump lives there.

## Riding

Press RIDE IT or R.

- The train starts at the station.
- Lift segments hold chain speed. Everything else is gravity, drag, and friction doing their jobs.
- The brake run in the final approach to the station slows the train to a stop at the station. That ends the lap. No button mash, no missed stop.
- HUD shows speed in km/h, height, and live G-force.
- Cameras: POV, chase, orbit. Press C to cycle. Esc to exit.

At the end of the lap you get a summary:

- lap time
- max speed
- max G
- min G
- airtime seconds - time spent under 0.5 G, the floaty bit

Then: Ride Again, or Back to Edit.

Read your Gs honestly. High max G with a near-zero min G usually means one heroic hill and one violent corner. Fix the corner.

## The library

Press L, or Ctrl+S to quick-save the current work by name from the save flow.

- Coasters are saved by name into a library, stored in your browser's localStorage.
- The current work also autosaves, so a refresh does not eat your coaster.
- Library cards show a top-down blueprint thumbnail of the layout, the name, saved date, node count, track length, and max height.
- On a card: open, rename, duplicate, delete.
- Duplicate before a big experiment is the cheapest insurance there is.

### Where saves actually live

In your browser, on that device, nowhere else. They do not sync, they do not upload, there is no account to recover them from. Clear your browser storage and they are gone. If a coaster matters, export it as a file too. See below.

## Sharing and exports

All one-click buttons in the app.

- JSON download - the full coaster as a file. Keep it, back it up, send it to someone. JSON import in the app reads it back. Import also accepts the older v0 raw node array format, so old files still work.
- Copy Share Link - the coaster is encoded into the page URL hash, after the `#c=`. Send the link, the other person opens it and gets that coaster. The data is in the link itself, not on a server. Long link? Yes. That is the trade.
- NL2 CSV export - one row per track sample, with position and up vectors. That is the spline data a NoLimits 2-style importer needs. If you want to take a SomeLimits layout into that world, this is the bridge.
- CSV import - a CSV in that same position-plus-up layout turns back into nodes you can edit here. The bridge runs both ways.
- PNG screenshot - a still of the current 3D view. For showing off, not for rebuilding from.

Share links and JSON are the two real sharing formats. A screenshot is a picture of a coaster, not a coaster.

## FAQ

**Is this NoLimits?**
No, and that is the point. Original code, original assets, a similar relaxed building feel. Not affiliated with NoLimits.

**Does it have loops from a menu?**
No. You are the menu: crank banking past 90 on a tight turn. A loop is shape plus banking plus speed, same as it ever was underneath the prefab buttons.

**Where are my saves?**
In your browser, nowhere else. localStorage, on that device. No sync, no cloud, no account. Export JSON for anything you would be sad to lose.

**Why did my train get a lift I did not ask for?**
Because the climb between two nodes is 8 m or more. Auto-lift. It stops first coasters stalling on their first hill. Lower the climb below 8 m if you truly do not want it.

**Why did my track change a little when I let go?**
Auto-smooth. On drag release, the moved node's neighbourhood gets a gentle smoothing pass on positions and banking. Small on purpose.

**Can I make a straight?**
Drag nodes into a line. There is no strict-node system to learn in v1, and that omission is deliberate. Planned refinements are marked planned in the dev docs, not promised here.

**Does it have parks, terrain, other rides, scripting?**
No. v1 is one closed-circuit coaster, built well, then ridden. Other stuff is planned at most, and most of it is not planned at all.

**It needs the internet?**
Once, for the Three.js library from the CDN. After that the page is just a file doing maths. Your saves do not need the internet at all - they never leave the browser.

**My coaster is ugly and slow. Whose fault?**
Probably the second hill. It is usually the second hill. Raise the first, lower the second, bank the turn between them, ride it again.
