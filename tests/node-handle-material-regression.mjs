// The selected control point is white; the other N-1 are lime.
// A rebuild must share TWO materials, not allocate N identical ones.
// Exercise the helper extracted from the real one-file production game.
// Run after temporary pinned Three.js install:
//   npm install --no-save --no-package-lock three@0.160.0
//   node tests/node-handle-material-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'production player module missing');
new Function(script.replace(/^import[^\n]*\n/gm,'')); // parse exact player syntax
const start=script.indexOf('function buildNodeHandles() {');
const end=script.indexOf('function buildTrack() {',start);
assert.ok(start>=0&&end>start,'single shared node-handle helper missing');
const helper=script.slice(start,end);
assert.equal((script.match(/buildNodeHandles\(\);/g)||[]).length,2,
  'both full track and first-station renderer must use common helper');
assert.ok(!helper.includes('new THREE.InstancedMesh'),
  'handles need separate raycast ownership; sharing materials, NOT meshes');
function make(nodes,selected){
  const handleGroup=new THREE.Group(),proxyCalls=[];
  const addHitProxy=(group,pos,kind,userData)=>{
    assert.equal(group,handleGroup);
    proxyCalls.push({position:pos.clone(),kind,userData:{...userData}});
  };
  const fn=new Function('THREE','nodes','selected','handleGroup','addHitProxy',
    helper+'\nreturn buildNodeHandles;')(THREE,nodes,selected,handleGroup,addHitProxy);
  fn();
  return {handleGroup,proxyCalls};
}
function classify({handleGroup,proxyCalls},nodes,selected){
 const meshes=handleGroup.children;
 assert.equal(meshes.length,nodes.length,'exactly one visible handle per control point');
 assert.equal(proxyCalls.length,nodes.length,'each independent point must retain a pick proxy call');
 const geos=new Set(meshes.map(m=>m.geometry));
 const mats=new Set(meshes.map(m=>m.material));
 assert.equal(geos.size,nodes.length?1:0,'one shared sphere geometry within a track rebuild');
 assert.equal(mats.size,Math.min(nodes.length,2),'only active and inactive visual materials');
 for(let i=0;i<nodes.length;i++){
  const h=meshes[i],n=nodes[i],isSelected=i===selected;
  assert.equal(h.userData.nodeIndex,i,'unique point identity and raycast owner');
  assert.equal(h.position.x,n.x);assert.equal(h.position.y,n.h);assert.equal(h.position.z,n.z);
  assert.equal(h.material.color.getHex(),isSelected?0xffffff:0xc6ff00);
  assert.equal(h.material.emissive.getHex(),isSelected?0x445500:0x222a00);
  assert.equal(proxyCalls[i].kind,'node');
  assert.equal(proxyCalls[i].userData.nodeIndex,i);
  assert.ok(proxyCalls[i].position.equals(h.position));
 }
 if(nodes.length>2){
   const inactive=meshes.filter((_,i)=>i!==selected);
   for(const h of inactive)assert.equal(h.material,inactive[0].material,
     'all inactive nodes must reuse one material instance');
 }
 return {meshCount:meshes.length,materialCount:mats.size,geoCount:geos.size,mats,geos};
}
const empty=make([],0);classify(empty,[],0);
const lone=[{x:4,h:3,z:-8}];const one=make(lone,0);classify(one,lone,0);
const nodes=Array.from({length:80},(_,i)=>({
 x:Math.cos(i*Math.PI/40)*70,
 z:Math.sin(i*Math.PI/40)*65,
 h:5+i*.1,bank:0
}));
const first=make(nodes,0),sizes=classify(first,nodes,0);
assert.equal(sizes.materialCount,2,'80-node rebuild should allocate 2 node materials, not 80');
const middle=make(nodes,53);classify(middle,nodes,53);
assert.equal(middle.handleGroup.children[53].material.color.getHex(),0xffffff);
assert.equal(middle.handleGroup.children[0].material.color.getHex(),0xc6ff00);
assert.notEqual(first.handleGroup.children[0].material,
  middle.handleGroup.children[0].material,
  'temporary material ownership must stay per disposable build group');
// The real production disposer gathers unique object resources. Confirm
// a shared normal material and shared sphere geometry are NOT double-freed.
const disposeStart=script.indexOf('function disposeEditGroup(group) {');
const disposeEnd=script.indexOf('function touchHaloRadius(',disposeStart);
assert.ok(disposeStart>=0&&disposeEnd>disposeStart);
const disposeCode=script.slice(disposeStart,disposeEnd);
let detach=0,geoDisposals=0,matDisposals=0;
const scene={remove(group){assert.equal(group,first.handleGroup);detach++;}};
const proxyGeoUnit={dispose(){throw Error('global hit proxy geometry must not be disposed')}};
const hitProxyMat={dispose(){throw Error('global hit proxy material must not be disposed')}};
for(const g of sizes.geos)g.dispose=()=>{geoDisposals++;};
for(const m of sizes.mats)m.dispose=()=>{matDisposals++;};
const dispose=new Function('scene','proxyGeoUnit','hitProxyMat',
  disposeCode+'\nreturn disposeEditGroup;')(scene,proxyGeoUnit,hitProxyMat);
dispose(first.handleGroup);
assert.equal(detach,1);
assert.equal(geoDisposals,1,'shared sphere geometry must dispose exactly once');
assert.equal(matDisposals,2,'both owned node materials must dispose once each');
console.log('PASS node handle material pooling: 80 independent points, exactly 2 visual materials and 1 geometry, correct picks/colours, exact group-owned disposal, lone/blank parity');
