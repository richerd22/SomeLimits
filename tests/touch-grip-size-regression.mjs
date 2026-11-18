// Roll gizmo radius is an editing affordance, not coaster geometry.
// Verify actual player source works at both close and zoomed-out cameras.
// Run: node tests/touch-grip-size-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'missing game module');
new Function(script.replace(/^import[^\n]*\n/gm,''));
const begin=script.indexOf('function editGripRadius(n) {');
const end=script.indexOf('function buildSelectedEditHandles()',begin);
assert.ok(begin>=0&&end>begin,'missing shared touch grip sizing helper');
const radiusSource=script.slice(begin,end);
const THREE={Vector3:class {
  constructor(x,y,z){this.x=x;this.y=y;this.z=z;}
},MathUtils:{degToRad:v=>v*Math.PI/180}};
function camera(distance) {
  return {position:{distanceTo(pos){assert.equal(pos.x,0);assert.equal(pos.z,0);return distance;}},fov:62};
}
function sized(touch,dist,height=844){
 const editGripRadius=new Function('THREE','camera','COARSE','innerHeight',
   radiusSource+'\nreturn editGripRadius;')(THREE,camera(dist),touch,height);
 return editGripRadius({x:0,h:0,z:0});
}
assert.equal(sized(false,200),2.6,'desktop keeps original gizmo exactly');
assert.equal(sized(false,20),2.6,'desktop close keeps original');
assert.equal(sized(true,12),2.6,'touch nearby respects minimum world radius');
const d200=sized(true,200);
assert.ok(d200>10 && d200<20,'zoomed mobile grip needs meaningful world separation: '+d200);
const px=d200/(2*200*Math.tan(62*Math.PI/360)/844);
assert.ok(px>=43&&px<=45,'far grip should be ~44 CSS pixels in ideal projected plane, got '+px);
assert.ok(sized(true,450)>d200,'zooming out must grow the handle');
assert.equal(sized(true,5000),24,'world-space upper bound prevents enormous distant rings');
assert.ok(sized(true,200,390)>sized(true,200,844),'shorter screen means larger world gizmo for same CSS-pixel target');
const chosen=script.slice(script.indexOf('function buildSelectedEditHandles() {'),script.indexOf('function buildTrack() {'));
assert.ok(chosen.includes('const gripRadius = editGripRadius(n);'));
assert.ok(chosen.includes('new THREE.TorusGeometry(gripRadius,'));
assert.ok(chosen.includes('new THREE.CylinderGeometry(0.05, 0.05, gripRadius,'));
assert.ok(chosen.includes('rolled.x * gripRadius'));
assert.ok(chosen.includes('rolled.y * gripRadius'));
assert.ok(chosen.includes('rolled.z * gripRadius'));
assert.ok(!chosen.includes('TorusGeometry(2.6,'),'no fixed-size roll circle at far mobile zoom');
console.log('PASS: desktop original ring, touch near minimum, far CSS pixel sizing, upper clamp, visual ring/bar/grip in sync');
