// Round 28: drawing SIDE/FRONT places new source nodes in the visible plane.
// Extract the production helper from the game module. No replacement geometry
// implementation, test-time WebGL, or changes to the locked ride fingerprints.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'missing player module');
new Function(script.replace(/^import[^\n]*\n/gm,'')); // validate actual game module syntax
const start=script.indexOf('function openElevationPoint(prev, hit, view, snap = 0) {');
const end=script.indexOf('const draftRayPlane = new THREE.Plane();',start);
assert.ok(start>=0&&end>start,'missing elevation construction function');
const THREE={MathUtils:{clamp:(x,lo,hi)=>Math.min(hi,Math.max(lo,x))}};
const makePoint=new Function('THREE',script.slice(start,end)+'\nreturn openElevationPoint;')(THREE);
const prev={x:12.3,z:-10.7,h:42.5,bank:36,lift:true};
const unchanged=structuredClone(prev);
assert.deepEqual(makePoint(prev,{x:35.26,y:50.18,z:127},'side'),
  {x:35.3,z:-10.7,h:50.2,bank:36},'SIDE controls X+height and inherits Z+bank');
assert.deepEqual(makePoint(prev,{x:400,y:22.24,z:-40.16},'front'),
  {x:12.3,z:-40.2,h:22.2,bank:36},'FRONT controls Z+height and inherits X+bank');
assert.deepEqual(makePoint(prev,{x:500,y:123,z:6},'side'),
  {x:150,z:-10.7,h:80,bank:36},'drawing respects X and height upper clamps');
assert.deepEqual(makePoint(prev,{x:11,y:-22,z:-999},'front'),
  {x:12.3,z:-150,h:1,bank:36},'drawing respects Z lower clamp and height floor');
assert.equal(makePoint(prev,{x:12.3,y:42.8,z:999},'side'),null,
  'near-coincident new point is rejected without creating another node');
assert.equal(makePoint(prev,{x:12.3,y:42.5,z:-10.7},'front'),null);
assert.equal(makePoint(prev,{x:NaN,y:33,z:20},'side'),null);
assert.equal(makePoint(prev,{x:11,y:Infinity,z:20},'front'),null);
assert.equal(makePoint(prev,{x:13,y:12,z:8},'3d'),null);
assert.equal(makePoint(null,{x:13,y:12,z:8},'side'),null);
assert.deepEqual(prev,unchanged,'preview/helper never mutates source node');
for(const token of [
  "function buildClickAtElevation(point) {",
  "function draftPointFromRay() {",
  "draftRayPlane.setFromNormalAndCoplanarPoint(normal,",
  "if (building && editorView !== '3d') {",
  "if (point && buildClickAtElevation(point)) lastGroundAdd = performance.now();",
  "const draftGuideGeo = new THREE.BufferGeometry();",
  "new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage)",
  "draftGuideGeo.attributes.position.needsUpdate = true;",
  "function updateDraftPreview(point) {",
  "function hideDraftPreview() {",
  "function captureDrawingCamera(view) {",
  "function restoreDrawingCamera(view) {",
  "controls.zoomToCursor = view === '3d';",
  "draftingCameraStates = Object.create(null); // new/imported document"
]) assert.ok(script.includes(token),'missing actual drawing/camera lifecycle '+token);
for(const id of ['btnZoomIn','btnZoomOut','btnFrameView','zoomReadout'])
  assert.ok(html.includes('id="'+id+'"'),'missing zoom/fit control '+id);
assert.ok(!html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)[1].includes('openElevationPoint'));
console.log('PASS SIDE/FRONT open drafting: exact visible axes, bounds/rounding, immutable preview, stable camera and unchanged ride core');
