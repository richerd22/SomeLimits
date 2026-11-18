// Round 29: optional grid snapping remains opt-in and isolated from coaster physics.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'game module missing');
new Function(script.replace(/^import[^\n]*\n/gm,''));
const start=script.indexOf('function openElevationPoint(prev, hit, view, snap = 0) {');
const end=script.indexOf('const draftRayPlane = new THREE.Plane();',start);
assert.ok(start>=0&&end>start,'missing production snap helpers');
const THREE={MathUtils:{clamp:(value,lo,hi)=>Math.max(lo,Math.min(hi,value))}};
const fns=new Function('THREE',script.slice(start,end)+'\nreturn {openElevationPoint,draftCoordinate};')(THREE);
const {openElevationPoint,draftCoordinate}=fns;
assert.equal(draftCoordinate(12.36,0,-150,150),12.4,'OFF keeps 0.1m placement precision');
assert.equal(draftCoordinate(12.36,1,-150,150),12,'1m step floors to nearest metre');
assert.equal(draftCoordinate(12.36,5,-150,150),10,'5m step aligns to 5m grid');
assert.equal(draftCoordinate(13.8,5,-150,150),15,'5m step rounds upward near grid');
assert.equal(draftCoordinate(-152,5,-150,150),-150,'clamp x/z with snapping');
assert.equal(draftCoordinate(80.4,5,1,80),80,'height never exceeds 80m');
assert.equal(draftCoordinate(-4,5,1,80),1,'height never falls below 1m');
assert.equal(draftCoordinate(NaN,5,1,80),null,'invalid numbers are rejected');
const prev={x:7.3,z:-11.8,h:23.4,bank:-25,lift:true,station:false};
const before=structuredClone(prev);
assert.deepEqual(openElevationPoint(prev,{x:17.6,y:33.8,z:100},'side',5),
  {x:20,z:-11.8,h:35,bank:-25},'SIDE snaps X+height, hidden Z stays exact');
assert.deepEqual(openElevationPoint(prev,{x:900,y:28,z:-22.9},'front',5),
  {x:7.3,z:-25,h:30,bank:-25},'FRONT snaps Z+height, hidden X stays exact');
assert.deepEqual(openElevationPoint(prev,{x:17.6,y:33.8,z:100},'side'),
  {x:17.6,z:-11.8,h:33.8,bank:-25},'default OFF preserves previous round behavior');
assert.deepEqual(prev,before,'preview cannot mutate a control point');
for(const token of [
  "const x = draftCoordinate(hit.x, draftSnap, -150, 150);",
  "const z = draftCoordinate(hit.z, draftSnap, -150, 150);",
  "return {x, z, h: n.h, bank: n.bank};",
  "if (e.buttons === 0) updateDraftPreview(draftPointFromRay());",
  "if (editorView === 'top' && draftSnap) {",
  "draftSnap ? draftCoordinate(grabSnap.x + dx, draftSnap, -150, 150) : grabSnap.x + dx",
  "draftSnap ? draftCoordinate(grabSnap.z + dz, draftSnap, -150, 150) : grabSnap.z + dz",
  "function cycleDraftSnap() {",
  "draftSnap = draftSnap === 0 ? 1 : draftSnap === 1 ? 5 : 0;",
  "localStorage.setItem('somelimits-drawing-snap', String(draftSnap));",
  "function updateDraftPreview(point) {",
  "draftGuideGeo.attributes.position.needsUpdate = true;",
  "document" // source module guards and DOM integration
]) assert.ok(script.includes(token),'missing real snap/ghost/interaction hook '+token);
assert.ok(html.includes('id="btnGridSnap"')&&html.includes('id="draftMeasure"'));
assert.ok(!html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)[1].includes('draftSnap'));
console.log('PASS optional 1m/5m grid snapping, TOP preview, existing FREE default, bank/hidden axis preservation');
