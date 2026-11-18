# Player guide

Build a coaster. Ride it. That is the whole pitch.

This guide is also summarized in the app as the Field Manual. Press H.

## Your first coaster in five minutes

This is the preset path - a complete circuit first, pulled apart second. For the blank-plot path, see "From blank" below.

1. Open the app. You start on the title screen, then in the editor with a preset already loaded. It is already a complete, rideable circuit. You do not have to fix it before it works.
2. Drag a node. Drag a lime node sideways to move it across the plot, or straight up/down to raise/lower it. After the first clear movement, that drag stays on the chosen axis. No tool switch.
3. For precise height, drag the orange cap floating above the selected point or use the height slider - same number, different grip. Raise it to make a hill, lower it to make a valley.
4. Bank that node: drag the blue grip around it - it rides a ring around the point, and the track rolls as you pull it around. Banking runs from -180 to 180 degrees. Bank into turns so the ride does not throw you sideways.
5. Let go. The point stays exactly where you left it. Its neighbours and their banking values do not change behind your back. The spline between points is the smooth part.
6. Want a lift? Just make a climb of 8 m or more between two nodes - the chain lift grows by itself, drawn as a bright strip on the track. (A checkbox on the node can force a chain onto a shorter climb; it is an override, not the way.) Your first hill cannot stall because you missed a menu.
7. Press RIDE IT, or press R. You start at the station.

If that took more than five minutes, try a preset instead and pull it apart: Classic Circuit, Oval Cruiser, Get Wild, or Looper. All four are rideable as loaded - Looper has a real vertical loop in it, built the same way you would build one.

## From blank

The other way in, and the one the game is really about. **+ new coaster** clears the plot to bare grid - no track, no station, nothing.

1. Click the ground to place the station. Everything leaves from there.
2. Keep clicking to lay points out from it. Each click is the next point, and each point lands at ground level - the track runs flat until you raise something, and a drop is just what happens after a hill.
3. Drag points sideways to shape the plan; drag one up/down to make a hill. The orange cap is still the precise height grip. A climb of 8 m or more grows its own lift chain, drawn as a bright strip on the track.
4. Click the station (or the glowing ring around it) to close the circuit. Under 4 points it refuses, politely.
5. Press RIDE IT, or press R.

Closed the loop with no hill at all? It still rides. A genuinely flat circuit gets station-tire drive at about 23 km/h, since gravity has nothing to spend. Raise a point 8 m to get a proper lift-and-drop ride.

## The editor

- The track is a closed loop of nodes. One node is the station. That is where rides start and end.
- The selected node grows a pole down to the ground, a ring on its footprint, and an orange cap floating above it. The cap is the height handle: drag it up or down and the node's height follows, with the number floating beside it. Heights are never smoothed, inherited, or second-guessed - what you set is what stays. The panel sliders drive the same numbers for precision.
- The selected node also grows a blue grip on the end of a bar, riding a faint ring around the point. The grip is the banking handle: it sits wherever the current bank has rolled it, and dragging it around the ring rolls the track with it, degrees floating by the point. Shift-dragging the node sideways does the same thing the old way.
- Double-click the track to insert a node at that point.
- Use + node and delete node buttons if you prefer buttons. Minimum is 4 nodes - below that, a loop stops being a loop.
- Selected-node readout, bottom of the panel: segment length to the next node, climb to the next node, and grade. Use it when a drop feels too steep or too flat. The numbers tell you before the ride does.
- Undo and redo work the way you expect. Buttons, plus Ctrl+Z for undo, Ctrl+Shift+Z or Ctrl+Y for redo.

## Controls

### Mouse

| Action | How |
|---|---|
| Select and move a node | Drag the lime node sideways across the screen |
| Raise or lower a node | Drag the lime node up/down, or use the orange cap for precision |
| Bank a node | Drag the blue grip around the node - it rolls as you pull (or shift-drag / right-drag the node sideways) |
| Insert a node | Double-click the track, or click empty ground to drop one where you click |
| Orbit the camera | Drag empty space |
| Pan and zoom | Use the editor camera controls - drag and scroll as labelled in the app |

Height is a direct up/down node drag, an orange-cap drag or a slider. Banking is the grip drag, the sideways shift-drag, or the slider - all three drive the same number on the same node, and they stay in sync.

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
- On a climbing lift segment the chain holds the train at 7.0 m/s (25 km/h). It only engages uphill. The station dispatches at 6.5 m/s (23 km/h), so a long flat lead-in no longer takes all day.
- One big lift at the start is the classic shape: up slow, down fast, spend the height for the rest of the lap.

### Drops, hills, and speed

- On a gravity coaster, speed comes from height: gravity from slope, minus drag and rolling friction. A flat-only layout is the exception - it uses a small powered tire-drive floor. No invisible mountain.
- A drop that falls short will not magically make the next hill. Raise the first hill or lower the next one.
- Check grade in the selected-node readout. A wall is not a hill.

### Inversions

- There is no element menu. A loop or a roll is just shape plus banking plus speed.
- A vertical loop is a shape: run straight, then stack points over the same ground in a circle - up one side, across the top, down the other, out the bottom. Points may share a ground spot when their heights differ; the stacking is the technique. Pull the Looper preset apart to see one that works.
- The loop spends the drop: keep the loop's top well below your highest point. The train pays for every metre of loop out of the fall before it, and a loop nearly as tall as your lift ends with the train crawling over the top at walking pace. Smaller loop or taller hill - those are the only fixes, same as the real ones.
- A corkscrew is banking: set four points in a row to 0, 120, -120, 0 degrees. The blend wraps the short way round, so the roll keeps turning the same direction instead of unwinding.
- Keep speed up going in. Inversions at walking pace are just falling over, slowly.

### Smoothness

- Drag a point directly where it should be. The spline joins the points smoothly without moving your control points on release.
- Fewer, well-placed nodes usually ride smoother than a node every metre.
- If a section jerks, check the two nodes around it first - a sudden height or banking jump lives there.

## Riding

Press RIDE IT or R.

- The train starts at the station.
- Climbing lift segments hold chain speed. The station dispatches the train; flat-only circuits receive tire power. On regular gravity coasters, everything beyond the lift is gravity, drag and friction doing their jobs.
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
- The current work also attempts to autosave on every change. If the browser blocks storage or runs out of quota, the editor now warns you clearly; export JSON before leaving. An unfinished draft can be exported and reopened.
- Library cards show a top-down blueprint thumbnail of the layout, the name, saved date, node count, track length, and max height.
- On a card: open, rename, duplicate, delete.
- Duplicate before a big experiment is the cheapest insurance there is.

### Where saves actually live

In your browser, on that device, nowhere else. They do not sync, they do not upload, there is no account to recover them from. Clear your browser storage and they are gone. If autosave ever fails, the editor says so. Export JSON immediately, including a half-built coaster. If a coaster matters, export it as a file too. See below.

## Sharing and exports

All one-click buttons in the app.

- JSON download - the full coaster as a file, **even if you have only placed a station or are still building**. An unfinished build downloads as a draft JSON and imports as an open, editable track. Complete coasters use the established format; import also accepts the older v0 raw node array format.
- Copy Share Link - the coaster is encoded into the page URL hash, after the `#c=`. Send the link, the other person opens it and gets that coaster. The data is in the link itself, not on a server. Long link? Yes. That is the trade.
- NL2 CSV export - one row per track sample, with position and up vectors. That is the spline data a NoLimits 2-style importer needs. If you want to take a SomeLimits layout into that world, this is the bridge.
- CSV import - a CSV in that same position-plus-up layout turns back into nodes you can edit here. The bridge runs both ways.
- PNG screenshot - a still of the current 3D view. For showing off, not for rebuilding from.

Share links and JSON are the two real sharing formats. A screenshot is a picture of a coaster, not a coaster.

## FAQ

**Is this NoLimits?**
No, and that is the point. Original code, original assets, a similar relaxed building feel. Not affiliated with NoLimits.

**Does it have loops from a menu?**
No. You are the menu. A vertical loop is points stacked in a circle over the same ground; a corkscrew is banking set 0, 120, -120, 0 across four points. See Inversions, above - and the Looper preset is a working loop you can pull apart.

**Where are my saves?**
In your browser, nowhere else. localStorage, on that device. No sync, no cloud, no account. Export JSON for anything you would be sad to lose.

**Why did my train get a lift I did not ask for?**
Because the climb between two nodes is 8 m or more. Auto-lift. It stops first coasters stalling on their first hill. Lower the climb below 8 m if you truly do not want it.

**Will a drag move my other points?**
No. A plan drag changes only the grabbed point's ground position. Its neighbours, their heights and their banking stay where you left them. The rendered curve follows the nodes.

**Can I make a straight?**
Drag nodes into a line. There is no strict-node system to learn in v1, and that omission is deliberate. Planned refinements are marked planned in the dev docs, not promised here.

**Does it have parks, terrain editing, other rides, scripting?**
No parks, no other rides, no scripting - and the ground is code-drawn hills you can't shape. v1 is one closed-circuit coaster, built well, then ridden. Other stuff is planned at most, and most of it is not planned at all.

**It needs the internet?**
Once, for the Three.js library from the CDN. After that the page is just a file doing maths. Your saves do not need the internet at all - they never leave the browser.

**My coaster is ugly and slow. Whose fault?**
Probably the second hill. It is usually the second hill. Raise the first, lower the second, bank the turn between them, ride it again.
