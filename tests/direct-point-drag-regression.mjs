// The NoLimits-1 drag contract: exactly the grabbed control point moves.
// Run from repo root: node tests/direct-point-drag-regression.mjs
// No dependencies, game build, GPU, DOM or helper copy required.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'game module missing');
new Function(script.replace(/^import[^\n]*\n/gm,'')); // full module syntax

const from=script.indexOf('function setNodePlanPosition(');
const to=script.indexOf('/* presets are a document replace',from);
assert.ok(from>=0 && to>from,'point plan-setter missing');
const THREE={MathUtils:{clamp:(value,min,max)=>Math.min(Math.max(value,min),max)}};
const setNodePlanPosition=new Function('THREE',
  script.slice(from,to)+'\nreturn setNodePlanPosition;')(THREE);
assert.equal(typeof setNodePlanPosition,'function');
assert.ok(!script.includes('function smoothAround('),'do not reintroduce post-release moving-neighbor smoothing');
assert.ok(!script.includes('smoothAround(editedNode)'),'do not postprocess drag release');

function point(x,z,h,bank,station=false){return {x,z,h,bank,station};}
const nodes=[
  point(-60,12,3,30,true),
  point(-40,-38,7,-60),
  point(5,-58,50.5,145),
  point(52,-32,4,-120),
  point(70,22,5,0),
  point(45,62,18,70),
  point(-15,75,3,-175),
  point(-66,48,3,20)
];
const base=structuredClone(nodes);
assert.equal(setNodePlanPosition(nodes,2,13.2,-47.7),true,'actual drag must change position');
assert.equal(nodes[2].x,13.2);
assert.equal(nodes[2].z,-47.7);
assert.equal(nodes[2].h,50.5,'plan drag cannot change height');
assert.equal(nodes[2].bank,145,'plan drag cannot change the grabbed node banking');
assert.equal(nodes[2].station,false);
for(let i=0;i<nodes.length;i++){
  if(i===2)continue;
  assert.deepEqual(nodes[i],base[i],'a drag of node 2 must not move or bank node '+i);
}
const frozen=structuredClone(nodes);
assert.equal(setNodePlanPosition(nodes,2,13.2,-47.7),false,'identical pointer event no rebuild');
assert.deepEqual(nodes,frozen,'no-op pointer event has no changes');
assert.equal(setNodePlanPosition(nodes,2,999,-999),true,'limits apply to the grabbed point');
assert.equal(nodes[2].x,150);
assert.equal(nodes[2].z,-150);
for(let i=0;i<nodes.length;i++)if(i!==2)assert.deepEqual(nodes[i],base[i]);
assert.equal(setNodePlanPosition(nodes,99,1,1),false,'invalid node cannot mutate');
assert.equal(setNodePlanPosition(nodes,2,NaN,3),false,'invalid coordinate cannot mutate');
assert.equal(setNodePlanPosition(nodes,2,Infinity,4),false,'infinite coordinate cannot mutate');
assert.equal(setNodePlanPosition(nodes,2,3,-Infinity),false);
assert.equal(setNodePlanPosition(nodes,0,7,18),true,'station can be dragged without editing its role');
assert.equal(nodes[0].station,true,'station identity must remain on the node');
assert.equal(nodes[0].h,3);
assert.equal(nodes[0].bank,30);
console.log('PASS: exact plan drag, unchanged neighbors and banking, no-op inputs, invalid inputs, bounds and station role');
