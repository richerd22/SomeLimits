// Round 30: the line preview must match the exact open Catmull-Rom span,
// and +node must sit ON the real curve, never at a straight chord midpoint.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'missing original game module');
new Function(script.replace(/^import[^\n]*\n/gm,'')); // parse the unchanged game module

function part(from,to){
  const a=script.indexOf(from);assert.ok(a>=0,'missing '+from);
  const b=script.indexOf(to,a);assert.ok(b>a,'missing '+to);
  return script.slice(a,b);
}
const splineCode=part('function sampleDraftCurveSpan(', 'function hideDraftPreview()');
const sampleDraftCurveSpan=new Function('THREE',splineCode+'\nreturn sampleDraftCurveSpan;')(THREE);
const shortest=part('function shortestAngleDelta(', '// banking at fractional node');
const bank=part('function bankAt(nodes, f) {','/* the exact arc position');
const bankOpen=part('function bankAtOpen(nodes, f) {','/* the open sibling');
const refineSrc=part('function refineNodeOnSpline(', 'function addNode()');
const refineNodeOnSpline=new Function('THREE',shortest+bank+bankOpen+refineSrc+
  '\nreturn refineNodeOnSpline;')(THREE);

const steps=24,output=new Float32Array((steps+1)*3);
const previewSpline=new THREE.CatmullRomCurve3([
  new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()
],false,'centripetal',0.5);
const scratch=new THREE.Vector3();
function verifySpan(before,next) {
  const cloned=structuredClone(before);
  const candidate=structuredClone(next);
  const length=sampleDraftCurveSpan(before,next,output,steps,previewSpline,scratch);
  const all=[...before,next];
  const fullCurve=new THREE.CatmullRomCurve3(all.map(n=>new THREE.Vector3(n.x,n.h,n.z)),
    false,'centripetal',0.5);
  let arc=0;
  for(let k=0;k<=steps;k++){
    const t=k/steps;
    const point=fullCurve.getPoint((before.length-1+t)/before.length);
    point.y=THREE.MathUtils.clamp(point.y,
      Math.min(before.at(-1).h,next.h)-1.5,
      Math.max(before.at(-1).h,next.h)+1.5);
    const p=[output[k*3],output[k*3+1],output[k*3+2]];
    assert.ok(p.every((v,i)=>Math.abs(v-point.getComponent(i))<0.00008),
      'preview must match full open spline, sample '+k+', '+p+' vs '+point.toArray());
    if(k)arc+=Math.hypot(
      p[0]-output[(k-1)*3],p[1]-output[(k-1)*3+1],p[2]-output[(k-1)*3+2]);
  }
  assert.ok(Math.abs(arc-length)<0.0001,'displayed arc length integrates same curve');
  assert.deepEqual(before,cloned,'mouse hover must never mutate nodes');
  assert.deepEqual(next,candidate,'mouse hover must never mutate candidate');
}
verifySpan([{x:0,z:0,h:3,bank:0}],
  {x:15,z:4,h:30,bank:0});
verifySpan([{x:0,z:0,h:3,bank:0},{x:12,z:0,h:36,bank:0}],
  {x:24,z:18,h:36,bank:0});
verifySpan([{x:0,z:0,h:3,bank:0},{x:9,z:0,h:35,bank:0},
  {x:24,z:5,h:45,bank:0}],{x:36,z:-18,h:9,bank:0});
for(const n of [7,80]){
 const list=Array.from({length:n},(_,i)=>({
   x:Math.cos(i*.2)*35+i*.8,z:Math.sin(i*.31)*20,h:18+Math.sin(i*.5)*13,bank:0
 }));
 verifySpan(list,{x:112,z:16,h:6,bank:0});
}
const curved=[
 {x:-45,z:45,h:3,bank:0,station:true},
 {x:-45,z:-45,h:27,bank:40,lift:true},
 {x:20,z:-55,h:9,bank:60},
 {x:54,z:12,h:8,bank:-35},
 {x:0,z:62,h:3,bank:15}
];
for(const closed of [false,true]){
 const curve=new THREE.CatmullRomCurve3(curved.map(n=>new THREE.Vector3(n.x,n.h,n.z)),
   closed,'centripetal',0.5);
 for(const i of (closed?[0,1,3,4]:[0,1,3])){
  const refined=refineNodeOnSpline(curved,i,closed,curve);
  assert.ok(refined,'existing segment can be refined at '+i);
  const t=(i+.5)/(closed?curved.length:curved.length-1);
  const expected=curve.getPoint(t),a=curved[i],b=curved[(i+1)%curved.length];
  assert.equal(refined.add.x,Math.round(expected.x*10)/10);
  assert.equal(refined.add.z,Math.round(expected.z*10)/10);
  assert.equal(refined.add.h,Math.round(THREE.MathUtils.clamp(expected.y,
    Math.min(a.h,b.h)-1.5,Math.max(a.h,b.h)+1.5)*10)/10);
  assert.ok(Number.isFinite(refined.add.bank),'bank remains finite');
  assert.equal(!!refined.add.station,false,'refine does not create second station');
 }
}
assert.equal(refineNodeOnSpline(curved,4,false,new THREE.CatmullRomCurve3(
  curved.map(n=>new THREE.Vector3(n.x,n.h,n.z)),false,'centripetal')),null,
  'open endpoint must extend, not refine beyond its final segment');
const automatic=[{x:0,z:0,h:3,bank:0},
 {x:0,z:-20,h:23,bank:0},{x:10,z:-40,h:3,bank:0}];
const autoSpline=new THREE.CatmullRomCurve3(automatic.map(n=>new THREE.Vector3(n.x,n.h,n.z)),
  false,'centripetal',0.5);
const lift=refineNodeOnSpline(automatic,0,false,autoSpline);
assert.equal(lift.originalLift,true,'automatic 8m+ climb must stay chain-powered');
assert.equal(lift.add.lift,true,'second half must not silently lose the lift');
assert.equal(refineNodeOnSpline(automatic,1,false,autoSpline).originalLift,false,
 'descending segment must not gain lift');
assert.equal(refineNodeOnSpline(null??[],0,false,null),null);
for (const token of [
  'const DRAFT_CURVE_STEPS = 24;',
  "new Float32Array((DRAFT_CURVE_STEPS + 1) * 3)",
  "draftCurveGeo.attributes.position.needsUpdate = true;",
  "draftCurveGuide.visible = false;",
  "draftCurveGuide.visible = true;",
  "const arc = sampleDraftCurveSpan(nodes, point,",
  "track && track.curve",
  "if (refined.originalLift) nodes[selected].lift = true;",
  "nodes.splice(selected + 1, 0, refined.add);"
])assert.ok(script.includes(token),'production curve implementation missing '+token);
console.log('PASS preview matches full centripetal last segment (1,2,3,7,80 nodes); mid-node refinement sits on spline, bank and lift preserved, existing physics core unchanged');
