// Real camera-dependent editor gizmo transforms from play/index.html.
// No duplicated implementation and no runtime/editor build step.
// Run after installing test-only Three.js:
//   npm install --no-save --no-package-lock three@0.160.0
//   node tests/touch-grip-camera-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
new Function(script.replace(/^import[^\n]*\n/gm,''));
function source(begin,end) {
  const a=script.indexOf(begin),b=script.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,begin+' missing');
  return script.slice(a,b);
}
const sizing=source('function editGripRadius(n) {','function buildSelectedEditHandles()');
const resizing=source('function refreshTouchBankGizmo() {','function buildTrack()');
assert.ok(resizing.includes('g.proxy.position.copy(g.grip.position)'));
assert.ok(resizing.includes('g.bar.scale.y = scale'));
assert.ok(resizing.includes('g.ring.scale.set(scale, scale, 1)'));
assert.ok(resizing.includes('g.lastCamera.distanceToSquared(camera.position)'));
assert.ok(!resizing.includes('buildTrack('),'camera motion must NOT rebuild the coaster');
assert.ok(script.includes('controls.update();\n    refreshTouchBankGizmo();'),
  'render loop must resize after OrbitControls updates the camera');
assert.ok(script.includes('const gripProxy = addHitProxy('),
  'resize must retain the original grip hit proxy instead of allocating a new one');

const selectedNode={x:0,z:0,h:3,bank:0};
const nodes=[selectedNode];
const view=new THREE.PerspectiveCamera(62,390/844,0.1,1000);
view.position.set(0,40,92);
const origin=new THREE.Vector3(0,3,0),rolled=new THREE.Vector3(0,0,-1);
const firstDistance=view.position.distanceTo(origin);
const initialRadius=Math.min(24,Math.max(2.6,2*firstDistance*Math.tan(Math.PI*62/360)/844*44));
const ring={scale:new THREE.Vector3(1,1,1)};
const bar={scale:new THREE.Vector3(1,1,1)};
const grip={position:origin.clone().addScaledVector(rolled,initialRadius)};
const proxy={position:grip.position.clone(),scale:new THREE.Vector3(1,1,1)};
const metadata={nodeIndex:0,origin,rolled,ring,bar,grip,proxy,
  builtRadius:initialRadius,radius:initialRadius,
  lastCamera:view.position.clone(),lastHeight:844};
const handleGroup={userData:{touchBankGizmo:metadata}};
function create(coarse=true,mode='edit',editing=-1,viewportHeight=844) {
 return new Function('THREE','camera','COARSE','innerHeight','handleGroup','nodes',
    'selected','mode','dragging','heightDrag','banking','gripBank',
    sizing+'\n'+resizing+'\nreturn {refreshTouchBankGizmo,editGripRadius};'
 )(THREE,view,coarse,viewportHeight,handleGroup,nodes,0,
   mode,editing,-1,-1,-1);
}
const {refreshTouchBankGizmo,editGripRadius}=create();
assert.equal(metadata.radius,editGripRadius(selectedNode),'initial radius matches game helper');
const originalRing=ring,originalBar=bar,originalGrip=grip,originalProxy=proxy;
view.position.set(0,130,330); // zoom out without a track rebuild
const expectedFar=editGripRadius(selectedNode);
assert.ok(expectedFar>initialRadius,'camera zoom out must enlarge touch ring in world metres');
refreshTouchBankGizmo();
assert.equal(metadata.radius,expectedFar);
assert.ok(Math.abs(ring.scale.x-expectedFar/initialRadius)<1e-12);
assert.ok(Math.abs(ring.scale.y-expectedFar/initialRadius)<1e-12);
assert.equal(ring.scale.z,1,'ring plane keeps original thickness axis scale');
assert.ok(Math.abs(bar.scale.y-expectedFar/initialRadius)<1e-12,'bar reaches same ring radius');
assert.ok(grip.position.distanceTo(origin.clone().addScaledVector(rolled,expectedFar))<1e-12);
assert.ok(proxy.position.distanceTo(grip.position)<1e-12,'hit proxy follows visible blue grip');
assert.equal(proxy.scale.x,Math.max(2.3,view.position.distanceTo(grip.position)*0.025));
assert.equal(metadata.ring,originalRing);
assert.equal(metadata.bar,originalBar);
assert.equal(metadata.grip,originalGrip);
assert.equal(metadata.proxy,originalProxy);
const afterFar=grip.position.clone();
refreshTouchBankGizmo();
assert.ok(grip.position.equals(afterFar),'unchanged camera should be a no-op');
view.position.set(0,15,30);
refreshTouchBankGizmo();
assert.equal(metadata.radius,editGripRadius(selectedNode),'zooming back in restores smaller ring');
assert.ok(metadata.radius<expectedFar);
assert.ok(proxy.position.distanceTo(grip.position)<1e-12);
const beforeMode=metadata.radius;
view.position.set(0,80,200);
create(true,'ride').refreshTouchBankGizmo();
assert.equal(metadata.radius,beforeMode,'ride mode must not resize editor controls');
create(true,'edit',0).refreshTouchBankGizmo();
assert.equal(metadata.radius,beforeMode,'active point edit cannot move a held gizmo');
create(false,'edit').refreshTouchBankGizmo();
assert.equal(metadata.radius,beforeMode,'desktop must never run touch scaling');
const resized=create(true,'edit',-1,390);
resized.refreshTouchBankGizmo();
assert.equal(metadata.radius,resized.editGripRadius(selectedNode),
  'CSS viewport height changes must resize the ring even without camera movement');
console.log('PASS: camera zoom changes visible blue ring, bar, grip and proxy in place; no geometry disposal or track rebuild, no active-drag/desktop effects');
