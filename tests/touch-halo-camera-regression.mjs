// Keep the real production cap, node and grip picking spheres the same
// apparent thumb size while the camera zooms without rebuilding track.
// Run: npm install --no-save --no-package-lock three@0.160.0
//      node tests/touch-halo-camera-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
new Function(script.replace(/^import[^\n]*\n/gm,''));
function region(a,b){
 const i=script.indexOf(a),j=script.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,a+' not found');
 return script.slice(i,j);
}
const haloSource=region('function touchHaloRadius(kind, distance) {','/* the train:');
const radiusSource=region('function editGripRadius(n) {','function buildSelectedEditHandles()');
const cameraSource=region('function refreshTouchBankGizmo() {','function buildTrack()');
assert.ok(haloSource.includes('parent.userData.touchProxies.push({mesh: p, kind})'));
assert.ok(cameraSource.includes('for (const hit of handleGroup.userData.touchProxies || [])'));
assert.ok(!cameraSource.includes('buildTrack('),'camera transforms cannot resample geometry');
const view=new THREE.PerspectiveCamera(62,390/844,.1,1000);
view.position.set(0,40,92);
const node={x:0,h:3,z:0},nodes=[node],origin=new THREE.Vector3(0,3,0);
const group=new THREE.Group();
const geo=new THREE.SphereGeometry(1,8,6);
const mat=new THREE.MeshBasicMaterial();
const make=(coarse=true,mode='edit',dragging=-1,height=844)=>new Function(
 'THREE','COARSE','camera','innerHeight','handleGroup','nodes','selected',
 'mode','dragging','heightDrag','banking','gripBank','proxyGeoUnit','hitProxyMat',
 haloSource+'\n'+radiusSource+'\n'+cameraSource+'\nreturn {addHitProxy,touchHaloRadius,editGripRadius,refreshTouchBankGizmo};'
)(THREE,coarse,view,height,group,nodes,0,mode,dragging,-1,-1,-1,geo,mat);
const api=make();
assert.equal(api.touchHaloRadius('node',10),2.6);
assert.equal(api.touchHaloRadius('cap',10),2.4);
assert.equal(api.touchHaloRadius('grip',10),2.3);
assert.equal(api.touchHaloRadius('node',300),8.4);
assert.equal(api.touchHaloRadius('cap',300),7.8);
assert.equal(api.touchHaloRadius('grip',300),7.5);
const nodeProxy=api.addHitProxy(group,origin,'node',{nodeIndex:0});
const capProxy=api.addHitProxy(group,new THREE.Vector3(0,5.4,0),'cap',{heightNode:0});
const initialRadius=api.editGripRadius(node);
const rolled=new THREE.Vector3(0,0,-1);
const ring={scale:new THREE.Vector3(1,1,1)},
      bar={scale:new THREE.Vector3(1,1,1)},
      grip={position:origin.clone().addScaledVector(rolled,initialRadius)};
const gripProxy=api.addHitProxy(group,grip.position,'grip',{bankNode:0});
assert.equal(group.userData.touchProxies.length,3);
const g={nodeIndex:0,origin,rolled,ring,bar,grip,proxy:gripProxy,
  builtRadius:initialRadius,radius:initialRadius,lastCamera:view.position.clone(),lastHeight:844};
group.userData.touchBankGizmo=g;
const originals=[nodeProxy,capProxy,gripProxy];
const close=[nodeProxy.scale.x,capProxy.scale.x,gripProxy.scale.x];
view.position.set(0,130,330);
api.refreshTouchBankGizmo();
assert.equal(group.userData.touchProxies.length,3,
  'camera motion must not allocate extra picking spheres');
for(const [i,entry] of group.userData.touchProxies.entries()){
 assert.equal(entry.mesh,originals[i],'same Mesh instance reused after zoom');
 const d=view.position.distanceTo(entry.mesh.position);
 const expected=api.touchHaloRadius(entry.kind,d);
 assert.ok(Math.abs(entry.mesh.scale.x-expected)<1e-9,
   entry.kind+' picking halo must match camera distance exactly');
 assert.ok(entry.mesh.scale.x>close[i],'zoom-out should grow world-space halo for '+entry.kind);
}
assert.ok(gripProxy.position.equals(grip.position),'blue hit target must follow resized visible ball');
assert.ok(nodeProxy.position.equals(origin),'lime proxy stays on lime point');
assert.ok(capProxy.position.equals(new THREE.Vector3(0,5.4,0)),'orange proxy stays on orange cap');
assert.equal(group.children.length,3,'camera resizing must not allocate geometry or proxy meshes');
const afterFar=originals.map(x=>x.scale.x);
api.refreshTouchBankGizmo();
assert.deepEqual(originals.map(x=>x.scale.x),afterFar,'no camera movement is a no-op');
view.position.set(0,12,25);
api.refreshTouchBankGizmo();
assert.ok(nodeProxy.scale.x<afterFar[0]);
assert.ok(capProxy.scale.x<afterFar[1]);
assert.ok(gripProxy.scale.x<afterFar[2]);
const beforeActive=originals.map(x=>x.scale.x);
view.position.set(0,80,200);
make(true,'edit',0).refreshTouchBankGizmo();
assert.deepEqual(originals.map(x=>x.scale.x),beforeActive,
  'active point drag cannot retarget hit areas');
make(true,'ride').refreshTouchBankGizmo();
assert.deepEqual(originals.map(x=>x.scale.x),beforeActive,
  'ride mode does not update editor hit spheres');
make(false,'edit').refreshTouchBankGizmo();
assert.deepEqual(originals.map(x=>x.scale.x),beforeActive,
  'desktop has no touch proxy scaling');
const mobileSmall=make(true,'edit',-1,390);
mobileSmall.refreshTouchBankGizmo();
for(const item of group.userData.touchProxies){
 const d=view.position.distanceTo(item.mesh.position);
 assert.equal(item.mesh.scale.x,mobileSmall.touchHaloRadius(item.kind,d));
}
assert.equal(g.lastHeight,390,'portrait-to-landscape CSS size must be acknowledged');
console.log('PASS: node/cap/blue hit proxies retain thumb-sized camera scaling, stable mesh identities, correct centers, and no edit/ride/desktop side effects');
